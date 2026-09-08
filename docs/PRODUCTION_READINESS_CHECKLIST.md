# Meridian production readiness checklist

Reviewed 2026-09-08. This checklist reflects the current working tree. Items marked **Pending** must be completed or explicitly accepted before public production use.

## Release blockers

- [x] **Remove unsafe platform-admin promotion.** Resolved (S13). Signup and email verification never grant `super_admin`, even for addresses in `ADMIN_EMAILS` (covered by tests for verification enabled and disabled, and for invitations). Platform admins are granted only by the operator script `npm run admin:promote -- <email>`, which requires proven inbox ownership (a previously consumed verification or reset link) and otherwise issues a one-time verification link. `--demote` revokes.

- [x] **Define safe member-removal behavior.** Resolved (S14). Removal deactivates the member (`users.removed_at`, migration 0005) instead of deleting them. Owned accounts — including private accounts — and all entries, balances, transfers, and audit history are preserved under the deactivated owner. Sessions, auth tokens, and account shares (both directions) are revoked; removed members cannot sign in or be promoted. Re-inviting the email and accepting the emailed link reactivates the account. Tested: private-account access, linked transfers, balances, audit history, and guards (last admin, platform admin, non-admin).

- [x] **Make currency changes financially safe.** Resolved (F13). A currency change with active budgets and no available conversion rate is rejected with an actionable error; conversion of active budgets and the currency update run in one transaction. Superseded budget history is left untouched. Regression tests cover all four paths.

- [x] **Configure and verify real email delivery (code side).** Resolved in code: the mailer fails closed — console transport is refused when `NODE_ENV=production`, and SMTP without `SMTP_URL`/`MAIL_FROM` refuses to start; `/api/health` reports the misconfiguration as `degraded`; docker-compose requires the mail settings explicitly. **Remaining operator task before public launch:** set `MAIL_TRANSPORT=smtp`, `SMTP_URL`, `MAIL_FROM`, production `APP_URL`, then verify verification/reset/invitation/email-change messages against a real recipient inbox with SPF/DKIM/DMARC passing (see `docs/RUNBOOKS.md` §3).

- [x] **Make CI green.** The tree is fully Prettier-formatted; `format:check` passes. Lint, typecheck, tests, and production build verified locally on the formatted tree (see Current evidence).

## Cloudflare decision and migration

- [ ] **Choose the database strategy.** The application currently uses PostgreSQL and cannot use D1 by changing one environment variable. Decide between:
  - PostgreSQL retained externally, optionally accessed through Cloudflare Hyperdrive; or
  - a deliberate PostgreSQL-to-D1/SQLite port.

- [ ] **If using D1, port the data model and SQL.** Replace PostgreSQL-only UUID casts, JSONB, numeric types, intervals, advisory locks, `FOR UPDATE SKIP LOCKED`, and PostgreSQL migrations while preserving money precision, ledger invariants, authorization filters, and transaction atomicity.

- [ ] **Replace the long-running worker.** The current Node worker polls PostgreSQL continuously. Implement Cloudflare Queues consumers and scheduled triggers for email, recurring transactions, balance maintenance, cleanup, retries, deduplication, and dead-letter handling.

- [ ] **Run the actual Cloudflare compatibility check.** Add Wrangler configuration and test either vinext or OpenNext. Verify `proxy.ts`, CSP nonces, Server Actions, authenticated dynamic pages, API routes, exports, and error handling on the deployed runtime. A successful `next build` is insufficient.

- [ ] **Measure Workers limits.** Measure bundle size, cold starts, SSR/reporting CPU, password hashing CPU, imports, and large exports. The Workers Free CPU limit is 10 ms per HTTP request, so do not assume the free plan can run this workload.

- [ ] **Make migrations deployment-safe.** Use deploy-time database migrations. If PostgreSQL is retained, acquire a dedicated connection for the entire advisory-lock lifecycle; pooled calls must not acquire and release a session lock on different connections.

## Security and privacy

- [ ] Set `NODE_ENV=production` and use a valid HTTPS `APP_URL`.
- [ ] Generate and store a strong `MERO_SHARE_ENCRYPTION_KEY` if MeroShare is enabled.
- [ ] Configure trusted proxy behavior only for the actual hosting path; verify rate limits use reliable client metadata.
- [ ] Confirm session cookie security, logout/revocation, reset-token invalidation, email verification, and cross-family/account permission behavior through HTTP tests.
- [ ] Confirm exports contain only accounts visible to the requesting actor and that private data is never cached by the service worker or edge cache.
- [ ] Add abuse protection such as Turnstile to public signup, login, reset, and invitation endpoints if the app is internet-facing.
- [ ] Review `ADMIN_EMAILS`, seed settings, debug logging, and all production secrets before deployment. Keep `SEED_DEMO=false`.

## Data protection and operations

- [ ] Create a production backup schedule and retention policy.
- [ ] Store encrypted/off-site backups; R2 is suitable for export or backup objects, with access controls and lifecycle retention.
- [ ] Perform a restore drill into an isolated database and verify ledger totals, balances, users, sessions, and audit records.
- [ ] Configure `/api/health` monitoring and alerts for database failure, pending migrations, dead jobs, and mail failure.
- [ ] Decide how logs and audit records are retained, accessed, and deleted.
- [ ] Document rollback, migration rollback limits, secret rotation, incident response, and account recovery.
- [ ] Test graceful shutdown and retry behavior for email, recurring jobs, MeroShare sync, imports, and exports.

## Functional acceptance

- [ ] Run browser end-to-end tests against a staging deployment, including signup, verification, login/logout, password reset, invitations, member roles, private accounts, transfers, splits, budgets, currency changes, reports, exports/imports, recurring entries, and MeroShare.
- [ ] Test concurrent edits and retries for transfers, splits, imports, currency changes, and background jobs.
- [ ] Test mobile layout, accessibility, error states, loading states, print/export output, and service-worker update/logout behavior.
- [ ] Test with production-like data volume, including long account histories and large exports.
- [ ] Confirm email deliverability, sender authentication (SPF/DKIM/DMARC), reset links, invitation links, and HTTPS redirects.

## Current evidence

- Production build: passed (`NODE_ENV=production next build`).
- TypeScript: passed.
- ESLint: passed.
- Dependency audit: zero reported vulnerabilities.
- Automated tests: 161 passed across 26 files against an isolated PostgreSQL test database (includes new S13/S14/F13 and mail-configuration suites).
- Formatting gate: passing (`prettier --check .` clean after whole-tree format).
- Cloudflare runtime/deployment: not yet configured or tested.
- Browser end-to-end, real mail delivery, live MeroShare, production backup/restore, and Cloudflare limits: not yet verified.

## Release gate

Release only after every release blocker is resolved, the chosen Cloudflare architecture is tested in staging, the CI pipeline is green, a restore drill succeeds, and the functional acceptance suite passes against the deployed production-shaped environment.
