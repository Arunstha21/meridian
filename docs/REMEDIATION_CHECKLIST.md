# Meridian Remediation Checklist

## Status Matrix

| ID | Category | Title | Severity | Status | Step | Commit |
|---|---|---|---|---|---|---|
| S07 | Security | Test runner lacks database isolation | P0 | Fixed & Tested | Step 1 | `b8394c2` |
| S01 | Security | Direct object reference on entries | P0 | Fixed & Tested | Step 2 | `1ae7f3d` |
| S02 | Security | Incomplete isolation in accounts list | P0 | Fixed & Tested | Step 2 | `1ae7f3d` |
| S03 | Security | Unscoped family mutation endpoints | P0 | Fixed & Tested | Step 2 | `1ae7f3d` |
| S04 | Security | Unverified users access family data | P1 | Fixed & Tested | Step 2 | `1ae7f3d` |
| S05 | Security | Rate limit keying allows lockout/bypass | P1 | Fixed & Tested | Step 2 | `1ae7f3d` |
| S06 | Security | Export endpoint bypasses account privacy | P1 | Fixed & Tested | Step 2 | `1ae7f3d` |
| F01 | Finance | Split transaction invariant violations | P1 | Fixed & Tested | Step 3 | `a182aa2` |
| F02 | Finance | Transfer integrity and bilateral link | P1 | Fixed & Tested | Step 3 | `a182aa2` |
| F03 | Finance | Closed accounts accept mutations | P1 | Fixed & Tested | Step 3 | `a182aa2` |
| F04 | Finance | Balance recalculation drops >4k days | P1 | Fixed & Tested | Step 3 | `a182aa2` |
| F05 | Finance | FX math across different decimal exponents | P1 | Fixed & Tested | Step 3 | `a182aa2` |
| F06 | Finance | Hardcoded 2-decimal money assumptions | P2 | Fixed & Tested | Step 3 | `a182aa2` |
| F07 | Finance | Liability sign inversion on opening balances | P2 | Fixed & Tested | Step 3 | `a182aa2` |
| F08 | Finance | Non-atomic balance recalculation deletes | P2 | Fixed & Tested | Step 3 | `a182aa2` |
| F09 | Finance | FX cache and missing rate warnings | P2 | Fixed & Tested | Step 3 | `a182aa2` |
| S08 | Security | Rate limiting trusts spoofable forwarding headers | P2 | Fixed & Tested | Step 4 | 23fe1ee |
| S09 | Security | Dependency vulnerabilities (Drizzle, Nodemailer) | P2 | Fixed & Tested | Step 4 | 23fe1ee |
| OPS | Ops | Production mail validation & fail-closed | P1 | Fixed & Tested | Step 4 | 23fe1ee |
| OPS | Ops | Deployment defaults & loopback binding | P1 | Fixed & Tested | Step 4 | 23fe1ee |
| OPS | Ops | Concurrent migration advisory lock | P2 | Fixed & Tested | Step 4 | 23fe1ee |
| OPS | Ops | Worker queue monitoring & health route | P2 | Fixed & Tested | Step 4 | 23fe1ee |
| OPS | Ops | Operational backup & restore runbooks | P2 | Fixed & Tested | Step 4 | 23fe1ee |
| S10 | Security | Provider credentials in client props | P2 | Queued | Step 5 | |
| S11 | Security | Chat route CSRF and resource controls | P2 | Queued | Step 5 | |
| S12 | Security | Identity lifecycle & session revocation | P2 | Queued | Step 5 | |
| F10 | Finance | Sidebar net worth report inclusion filters | P2 | Queued | Step 5 | |
| F11 | Finance | Bigint / safe integer math in balances | P2 | Queued | Step 5 | |
| F12 | Finance | Currency change migration & budget limits | P2 | Queued | Step 5 | |

---

## Detailed Step Documentation

### Step 1: S07 — Test Runner Database Isolation
- **Status**: Fixed & Tested (`b8394c2`)
- **Issues Addressed**:
  - Prevent test runner from executing against production/application databases.
  - Require explicit `TEST_DATABASE_URL` differing from `DATABASE_URL`.
- **Commit**: `b8394c2`

### Step 2: S01–S06 — Access Control & Privacy Remediation
- **Status**: Fixed & Tested (`1ae7f3d`)
- **Issues Addressed**: S01, S02, S03, S04, S05, S06.
- **Commit**: `1ae7f3d`

### Step 3: F01–F09 — Financial Integrity Remediation
- **Status**: Fixed & Tested (`a182aa2`)
- **Issues Addressed**: F01, F02, F03, F04, F05, F06, F07, F08, F09.
- **Commit**: `a182aa2`

### Step 4: Release-Operability & Security Remediation (S08, S09, Ops)
- **Status**: Fixed & Verified
- **Issues Addressed**:
  - **S09 (P2)**: Dependency vulnerability resolution:
    - Upgraded `drizzle-orm` to `0.45.2`, resolving GHSA-gpj5-g38j-94v9.
    - Upgraded `nodemailer` to `10.0.1`, resolving GHSA-p6gq-j5cr-w38f.
    - `npm audit` reports 0 vulnerabilities.
  - **S08 (P2)**: Forwarding metadata & input length bounds:
    - Hardened `requestMeta()` in `src/server/auth/context.ts` to only trust `X-Forwarded-For` and `X-Real-IP` when `TRUST_PROXY=true` or `TRUST_PROXY_HEADERS=true`.
    - Added user agent string length capping (500 chars max).
  - **Verification Gates**:
    - Fixed React 19 SSR hook synchronization in `src/hooks/use-mobile.ts` with `useSyncExternalStore`.
    - Wrapped synchronous render updates in `src/components/finance/dashboard-customizer.tsx` inside microtasks.
    - Fixed relative navigation in `src/components/finance/recent-transactions.tsx`.
    - Cleaned unused imports and eliminated explicit `any` in test guards and domains.
    - `npm run lint` passes with 0 errors and 0 warnings.
    - `npm run typecheck` passes with 0 errors.
  - **Production Mail Validation**:
    - `createMailer()` in `src/server/security/mailer.ts` now fails closed with an explicit descriptive error when `MAIL_TRANSPORT=smtp` but `SMTP_URL` is omitted.
  - **Deployment Security Defaults**:
    - `docker-compose.yml`: Binds PostgreSQL port `5432` and Web port `3000` strictly to `127.0.0.1` (loopback) to prevent accidental public network exposure in self-hosted deployments.
    - Parameterized database credentials with environment variable substitution `${POSTGRES_PASSWORD:-...}`.
  - **Migration Concurrency Reliability**:
    - `src/server/db/migrate.ts`: Wrapped `migrateUp()` and `migrateDownStep()` with a PostgreSQL session advisory lock (`pg_advisory_lock(849201948)`), preventing race conditions across multi-replica container startups.
  - **Queue Observability & Health Route**:
    - Added `getQueueStats(exec)` in `src/server/queue/index.ts`.
    - Enhanced `/api/health` to expose database status, migration report, worker queue statistics (`pending`, `running`, `completed`, `dead`), and mail transport readiness.
  - **Runbooks & Operational Documentation**:
    - Created [`docs/RUNBOOKS.md`](file:///C:/Users/Arun/Development/meridian/docs/RUNBOOKS.md) detailing automated database backup/restore procedures (`pg_dump`/`pg_restore`), recovery testing, queue monitoring, and dead-letter job remediation.
- **Relevant Code Changes**:
  - [`package.json`](file:///C:/Users/Arun/Development/meridian/package.json)
  - [`package-lock.json`](file:///C:/Users/Arun/Development/meridian/package-lock.json)
  - [`docker-compose.yml`](file:///C:/Users/Arun/Development/meridian/docker-compose.yml)
  - [`src/server/security/mailer.ts`](file:///C:/Users/Arun/Development/meridian/src/server/security/mailer.ts)
  - [`src/server/db/migrate.ts`](file:///C:/Users/Arun/Development/meridian/src/server/db/migrate.ts)
  - [`src/server/queue/index.ts`](file:///C:/Users/Arun/Development/meridian/src/server/queue/index.ts)
  - [`src/app/api/health/route.ts`](file:///C:/Users/Arun/Development/meridian/src/app/api/health/route.ts)
  - [`src/server/auth/context.ts`](file:///C:/Users/Arun/Development/meridian/src/server/auth/context.ts)
  - [`src/server/domain/accounts.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/accounts.ts)
  - [`src/server/domain/balances.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/balances.ts)
  - [`src/hooks/use-mobile.ts`](file:///C:/Users/Arun/Development/meridian/src/hooks/use-mobile.ts)
  - [`src/components/finance/dashboard-customizer.tsx`](file:///C:/Users/Arun/Development/meridian/src/components/finance/dashboard-customizer.tsx)
  - [`src/components/finance/recent-transactions.tsx`](file:///C:/Users/Arun/Development/meridian/src/components/finance/recent-transactions.tsx)
  - [`tests/setup/database-guard.ts`](file:///C:/Users/Arun/Development/meridian/tests/setup/database-guard.ts)
  - [`tests/unit/mailer.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/unit/mailer.test.ts)
  - [`docs/RUNBOOKS.md`](file:///C:/Users/Arun/Development/meridian/docs/RUNBOOKS.md)
- **Regression Tests & Verification Results**:
  - `npm audit`: 0 vulnerabilities (drizzle-orm & nodemailer resolved).
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 errors.
  - `npm test`: 22 test files passed, 133/133 tests passed.
  - `npm run build`: Next.js Turbopack production build succeeded cleanly in 341ms.
