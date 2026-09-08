# Cloudflare deployment readiness review

Reviewed 2026-09-08 against the current working tree, including existing uncommitted changes.

**Decision: not ready for public production deployment or deployment to Cloudflare D1 as-is.** No production resources were created and no application code was changed by this review.

## Verification

| Check                                                            | Result                                 |
| ---------------------------------------------------------------- | -------------------------------------- |
| Production build                                                 | Passed, installed Next.js 16.3.2       |
| TypeScript                                                       | Passed                                 |
| ESLint                                                           | Passed                                 |
| npm audit                                                        | Zero reported vulnerabilities          |
| Unit and integration tests                                       | 147 passed across 24 files             |
| Formatting / CI                                                  | Failed: 155 files reported by Prettier |
| Cloudflare runtime build and deployment                          | Not configured or tested               |
| Browser end-to-end, mail delivery, live MeroShare, restore drill | Not verified in this review            |

Tests ran on a newly initialized, loopback-only PostgreSQL 16 cluster on port 55441, using `meridian_readiness_test`. The configured test database on port 55439 was unreachable, and the application's local database credentials could not connect. Application data was not used. Passing service tests and a Node.js build do not prove Workers runtime compatibility.

The earlier product/security review is historical evidence. Its export privacy, invitation elevation, service-worker navigation caching, and dependency findings have received changes; this report does not repeat them as unchanged defects. The remaining findings below were traced in the current source; they were not separately reproduced through a browser or new database probes.

## Release findings

### P1: Public signup can grant platform-admin privileges without email ownership

`src/server/domain/users.ts:54` sets `shouldBePlatformAdmin` when email verification is disabled and the supplied email is in `ADMIN_EMAILS`; line 74 persists `super_admin`. Email verification defaults to disabled in `src/lib/env.ts:20`. An attacker who knows an unregistered allowlisted email can claim it through public signup. Invitation protections do not close direct signup.

Remove unverified public elevation and use an operator-controlled bootstrap, or require successful inbox verification before promotion. Test direct registration and invitations with verification both enabled and disabled. Exposure depends on configuring an allowlisted address that has not already registered.

### P1: Removing a member silently destroys their owned ledger

`src/server/domain/users.ts:310` deletes every account owned by the removed user before deleting the user. The account-to-entry foreign key cascades in `db/migrations/0001_init.up.sql:113`. However, `src/app/(app)/settings/members/page.tsx:114` explicitly says transactions remain in the ledger.

This is both data loss and a permission concern: household admins can erase private accounts they could not otherwise manage. Preserve a deactivated owner and the records, or require an explicit disposition flow governed by account permissions. Test preserved entries, account privacy, and linked transfers after member removal. Changing the confirmation alone would not resolve the underlying ownership policy.

### P1: Changing currency can reinterpret budget amounts without conversion

`src/server/domain/families.ts:65` looks up an exchange rate, but updates budget amounts only inside `if (rate)`. It still writes the new family currency afterward. With an existing USD budget and no USD/NPR rate, the change succeeds while retaining the numeric minor-unit amount, which now has a different financial meaning.

Reject the change if a required rate is unavailable, or require an explicitly supplied conversion rate. Keep conversion and the currency update atomic. The server action already wraps this operation in a transaction; that does not prevent the missing-rate branch from committing successfully. Add a missing-rate regression and test concurrent currency changes.

### P2: Production mail can appear healthy without delivering anything

`src/lib/env.ts` and Docker Compose default to console mail. `ConsoleMailer` logs instead of sending; production redacts the body. `/api/health` nevertheless reports console mail as ready. Password reset, invitation, and verification delivery therefore need explicit production configuration and a real delivery check. Reject console mail in public production or represent disabled mail accurately. Validate HTTPS `APP_URL`, sender identity, encryption secrets, and verification settings before rollout.

### P2: CI is not green

The CI workflow runs `format:check`, which currently fails on 155 files. Format the agreed release tree and rerun that gate. This is separate from the functional and security blockers.

### P2: Migration lock is not pinned to one connection

`src/server/db/migrate.ts:34` and `:52` acquire/release a session advisory lock through the pooled database executor; `src/server/db/client.ts:14` allows ten connections. Pool calls do not guarantee the same PostgreSQL session, especially if the executor is also used concurrently. An unlock can execute on a different connection and leave the lock held. Use a dedicated checked-out connection for the complete migration/lock lifecycle, and verify concurrent migration runners. This is a reliability risk established by source inspection, not a reproduced deadlock.

## Cloudflare fit

| Component         | Current implementation                                          | Required work                                                                                                                                               |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web               | Next.js Node server, Server Actions, dynamic routes, CSP proxy  | Choose and verify a Workers adapter; add Wrangler configuration, bindings, preview/build/deployment workflow                                                |
| Database          | PostgreSQL, Drizzle `pgTable`, `pg` pool                        | Port schema, queries, migrations, and transaction boundaries to D1/SQLite                                                                                   |
| SQL semantics     | UUID casts, JSONB, numeric types, intervals, row/advisory locks | Replace PostgreSQL-specific semantics while preserving ledger atomicity and precision                                                                       |
| Background jobs   | Continuous Node polling loop and PostgreSQL queue               | Event-driven Queues consumers and scheduled triggers; preserve deduplication, retries, transaction-to-job consistency, recovery, and dead-letter visibility |
| Health/migrations | Reads SQL files from local filesystem at request time           | Deploy-time D1 migrations and runtime-compatible migration metadata/health checks                                                                           |
| Authentication    | Node crypto scrypt                                              | Verify actual Workers behavior and CPU cost; do not weaken hashing to fit a free quota                                                                      |
| Mail              | Nodemailer SMTP / console                                       | Configure and test a compatible delivery transport                                                                                                          |

D1 uses SQLite semantics, so replacing `DATABASE_URL` is insufficient. The port must preserve atomic transfers, split sums, integer money, deletion policy, idempotent imports, family isolation, and job delivery across failures. See [D1 overview](https://developers.cloudflare.com/d1/).

Cloudflare currently recommends **vinext**, which is in beta, for Next.js applications. Its guide explicitly calls for compatibility checks for existing production apps. OpenNext remains another deployment path. Select the adapter through a compatibility spike, including this app's `proxy.ts`, CSP nonces, Server Actions, authenticated caching, and exports. A successful `next build` is not an adapter acceptance test. See [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/).

Keeping PostgreSQL would reduce database migration work. Hyperdrive can connect Workers to an existing database, but is not a replacement database; that option still requires PostgreSQL hosting and runtime/job adaptation. It does not meet the request for D1. See [Hyperdrive](https://developers.cloudflare.com/hyperdrive/get-started/).

## Useful free allowances

Checked against official documentation on the review date. Allowances are account/plan limits, not a guarantee this application will fit.

| Service       | Free allowance                                                                                          | Fit for Meridian                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Workers       | 100,000 requests/day; 10 ms CPU per HTTP request                                                        | Web hosting after adaptation; measure SSR, scrypt, reports, and import costs                                |
| D1            | 5 million rows read/day; 100,000 rows written/day; 5 GB total storage, with 500 MB per database on Free | Ledger after a deliberate SQLite port; indexes and balance recalculation affect row usage                   |
| Queues        | 10,000 operations/day; 24-hour message retention                                                        | Emails, sync, maintenance; normal small-message delivery generally consumes three operations before retries |
| R2 Standard   | 10 GB-month storage, 1 million Class A and 10 million Class B operations/month; free egress             | Private exports, backups, future receipt attachments; define retention and access controls                  |
| Turnstile     | Free plan                                                                                               | Signup/login abuse protection, after server-side verification and CSP integration                           |
| Web Analytics | Free                                                                                                    | Optional traffic/performance analytics                                                                      |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), [Web Analytics](https://developers.cloudflare.com/web-analytics/about/).

Cloudflare Email Routing is free for inbound mail and sending to verified destination addresses. Sending to arbitrary app users requires Workers Paid; it includes 3,000 outbound emails/month, followed by usage charges. Do not count unrestricted transactional email as a free-tier feature. See [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

Free Workers' 10 ms CPU budget is a material concern for SSR and password hashing; no Workers CPU or bundle measurement was performed. R2 has usage billing beyond its free allowance. D1 can reject queries when daily free allowances are exhausted. A fully free deployment therefore remains unproven.

## Recommended sequence

1. Fix the three P1 release findings, mail readiness, migration locking, and the existing formatting gate.
2. Perform a Workers compatibility spike and measure authentication, SSR, reporting, and import CPU/bundle limits.
3. If Cloudflare-owned SQL storage is the requirement, port to D1 and event-driven jobs in a separate implementation effort. Run financial and authorization regressions against D1 itself.
4. Configure production secrets, HTTPS origin, sender, trusted proxy metadata, private storage, and scheduled backups. Verify export/restore on an isolated target.
5. Deploy a staging instance, then exercise signup/login/reset, private-account access, member removal, transfers/splits, budgets/currencies, recurring jobs, MeroShare, and export/import through the actual deployed runtime.
6. Release the tested revision only after these gates pass. Public deployment is not recommended for the current tree.
