# Cloudflare deployment assessment

Assessed on 2026-09-09. Target: entirely cloud-hosted, Cloudflare-only services,
Workers Free plan, approximately three users. This is a migration plan, not a
working deployment configuration. The application still requires PostgreSQL.

## Current status

- Repository published at https://github.com/Arunstha21/meridian on `master`.
- CI accepts pushes to both `main` and `master`.
- Cloudflare CLI sign-in is required before inspecting account resources.
- No Cloudflare production deployment or D1 migration has been performed.

## Free-plan constraints

Cloudflare [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
include 100,000 requests/day and 10 ms CPU per HTTP request and per Cron Trigger.
The current documentation lists a 64 MiB Worker size limit for both plans;
older OpenNext documentation still describes the previous compressed-size limits.

[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) includes
5 million rows read/day, 100,000 rows written/day, and 5 GB total storage on Free.
Separate per-database limits apply. Exceeding the free query allowance causes
queries to fail; it does not automatically upgrade the account. Three users alone
do not establish that CPU, query, or storage usage will remain within allowances.

[Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
allows free sends to verified destination addresses. Sending to arbitrary recipients
requires Workers Paid. A three-person setup can investigate verified destinations,
but sender-domain setup and delivery must be verified before replacing SMTP.

## Required application changes

1. **Database:** Replace the PostgreSQL Drizzle schema and SQL migrations with
   SQLite/D1 equivalents. Audit UUID generation, JSON, timestamps, exact monetary
   values, foreign keys, partial indexes, casts, and PostgreSQL-specific queries.
   Hyperdrive connects to an external database; it does not host PostgreSQL.
2. **Atomic writes:** Redesign the interactive transactions in the ledger,
   transfers, splits, membership, invitations, recurring entries, imports, and
   security flows using D1-supported atomic operations. Simply replacing the
   driver or dropping transaction wrappers is insufficient. Test rollback,
   concurrent updates, authorization, and duplicate submission behavior.
3. **Background work:** Replace the continuously polling Node process and
   `FOR UPDATE SKIP LOCKED` job claims with bounded scheduled invocations and
   atomic claims. Preserve retries, deduplication, stale-job recovery, and
   scheduled maintenance. Each invocation must fit the Free CPU allowance.
4. **Authentication:** Measure password hashing in Workers before choosing a
   compatible authentication strategy. A local Node CPU probe of the existing
   scrypt parameters (N=16384, r=8, p=1, 64-byte output) measured 31-32 ms across
   five runs. This is not a Workers benchmark, but exceeds its advertised Free
   CPU budget. Do not weaken password hashing to make deployment fit. An
   alternative such as verified identity from Cloudflare Access changes the login
   experience and needs an explicit product decision and JWT validation.
5. **Email:** Add and verify a Cloudflare mail transport for the permitted users;
   retain the production guard against silently discarding account emails.
6. **Web runtime:** Add a compatible Next.js adapter, Wrangler configuration, and
   preview checks. At assessment time the latest OpenNext adapter required a newer
   Next.js release than the installed version. Verify the chosen versions together.
   Avoid provisioning optional billable cache/image services by default.
7. **Release:** Verify login, account creation, ledger writes, transfers, splits,
   reports, recurring work, email delivery, imports, and MeroShare in the target
   runtime. Check actual CPU and D1 metrics on the Free account. Keep optional AI
   disabled until a separately approved free configuration exists.

## Account and data setup still needed

- Complete `npx wrangler login` in the account owner's browser.
- Confirm the selected account is on Workers Free before provisioning resources.
- Establish whether production starts empty or needs a migration of existing data.
  Use a separate staging database first; do not reset or overwrite local finances.
- Resolve authentication and email configuration, including any existing domain
  and verified recipients, without purchasing a domain or upgrading services.
- Use a free `workers.dev` address for the application where compatible with the
  selected authentication setup. Store secrets in Cloudflare, never Git.

## References

- [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Hyperdrive overview](https://developers.cloudflare.com/hyperdrive/)
- [OpenNext setup](https://opennext.js.org/cloudflare/get-started)
- [OpenNext scheduled handler](https://opennext.js.org/cloudflare/howtos/custom-worker)
