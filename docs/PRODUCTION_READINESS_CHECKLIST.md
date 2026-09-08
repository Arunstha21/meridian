# Meridian production readiness checklist

Reviewed 2026-09-08. This checklist reflects the current working tree. Items marked **Pending** must be completed or explicitly accepted before public production use.

## Release blockers

- [ ] **Remove unsafe platform-admin promotion.** Public signup must never grant `super_admin` based only on an email in `ADMIN_EMAILS`. Use a trusted bootstrap/operator flow and require inbox ownership before any promotion. Cover direct signup and invitations with email verification enabled and disabled.

- [ ] **Define safe member-removal behavior.** Removing a member currently deletes their owned accounts, which cascades to ledger entries, while the UI says transactions remain. Preserve the accounts and records under a deactivated owner, or implement an explicit authorized transfer/disposition flow. Test private-account access, linked transfers, balances, and audit history after removal.

- [ ] **Make currency changes financially safe.** If a budget conversion rate is unavailable, reject the currency change or require an explicit rate. Never commit a new family currency while retaining amounts whose numeric meaning belongs to the old currency. Keep conversion and the currency update atomic and add regression tests.

- [ ] **Configure and verify real email delivery.** Set `MAIL_TRANSPORT=smtp`, `SMTP_URL`, `MAIL_FROM`, and the production `APP_URL`. Test verification, password reset, invitation, and email-change messages using a real recipient. Do not treat console mail as production-ready.

- [ ] **Make CI green.** `npm run format:check` currently reports 155 files. Format the intended release tree and rerun lint, typecheck, tests, formatting, and build in CI.

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

- Production build: passed.
- TypeScript: passed.
- ESLint: passed.
- Dependency audit: zero reported vulnerabilities.
- Automated tests: 147 passed across 24 files against an isolated PostgreSQL test database.
- Formatting gate: pending; currently fails on 155 files.
- Cloudflare runtime/deployment: not yet configured or tested.
- Browser end-to-end, real mail delivery, live MeroShare, production backup/restore, and Cloudflare limits: not yet verified.

## Release gate

Release only after every release blocker is resolved, the chosen Cloudflare architecture is tested in staging, the CI pipeline is green, a restore drill succeeds, and the functional acceptance suite passes against the deployed production-shaped environment.
