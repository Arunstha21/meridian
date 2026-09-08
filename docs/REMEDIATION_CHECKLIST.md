# Meridian Remediation Checklist

## Status Matrix

| ID  | Category | Title                                             | Severity | Status         | Step   | Commit    |
| --- | -------- | ------------------------------------------------- | -------- | -------------- | ------ | --------- |
| S07 | Security | Test runner lacks database isolation              | P0       | Fixed & Tested | Step 1 | `b8394c2` |
| S01 | Security | Direct object reference on entries                | P0       | Fixed & Tested | Step 2 | `1ae7f3d` |
| S02 | Security | Incomplete isolation in accounts list             | P0       | Fixed & Tested | Step 2 | `1ae7f3d` |
| S03 | Security | Unscoped family mutation endpoints                | P0       | Fixed & Tested | Step 2 | `1ae7f3d` |
| S04 | Security | Unverified users access family data               | P1       | Fixed & Tested | Step 2 | `1ae7f3d` |
| S05 | Security | Rate limit keying allows lockout/bypass           | P1       | Fixed & Tested | Step 2 | `1ae7f3d` |
| S06 | Security | Export endpoint bypasses account privacy          | P1       | Fixed & Tested | Step 2 | `1ae7f3d` |
| F01 | Finance  | Split transaction invariant violations            | P1       | Fixed & Tested | Step 3 | `a182aa2` |
| F02 | Finance  | Transfer integrity and bilateral link             | P1       | Fixed & Tested | Step 3 | `a182aa2` |
| F03 | Finance  | Closed accounts accept mutations                  | P1       | Fixed & Tested | Step 3 | `a182aa2` |
| F04 | Finance  | Balance recalculation drops >4k days              | P1       | Fixed & Tested | Step 3 | `a182aa2` |
| F05 | Finance  | FX math across different decimal exponents        | P1       | Fixed & Tested | Step 3 | `a182aa2` |
| F06 | Finance  | Hardcoded 2-decimal money assumptions             | P2       | Fixed & Tested | Step 3 | `a182aa2` |
| F07 | Finance  | Liability sign inversion on opening balances      | P2       | Fixed & Tested | Step 3 | `a182aa2` |
| F08 | Finance  | Non-atomic balance recalculation deletes          | P2       | Fixed & Tested | Step 3 | `a182aa2` |
| F09 | Finance  | FX cache and missing rate warnings                | P2       | Fixed & Tested | Step 3 | `a182aa2` |
| S08 | Security | Rate limiting trusts spoofable forwarding headers | P2       | Fixed & Tested | Step 4 | `1a0bfa6` |
| S09 | Security | Dependency vulnerabilities (Drizzle, Nodemailer)  | P2       | Fixed & Tested | Step 4 | `1a0bfa6` |
| OPS | Ops      | Production mail validation & fail-closed          | P1       | Fixed & Tested | Step 4 | `1a0bfa6` |
| OPS | Ops      | Deployment defaults & loopback binding            | P1       | Fixed & Tested | Step 4 | `1a0bfa6` |
| OPS | Ops      | Concurrent migration advisory lock                | P2       | Fixed & Tested | Step 4 | `1a0bfa6` |
| OPS | Ops      | Worker queue monitoring & health route            | P2       | Fixed & Tested | Step 4 | `1a0bfa6` |
| OPS | Ops      | Operational backup & restore runbooks             | P2       | Fixed & Tested | Step 4 | `1a0bfa6` |
| S10 | Security | Provider credentials in client props              | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| S11 | Security | Chat route CSRF and resource controls             | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| S12 | Security | Identity lifecycle & session revocation           | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| F10 | Finance  | Sidebar net worth report inclusion filters        | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| F11 | Finance  | Bigint / safe integer math in balances            | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| F12 | Finance  | Currency change migration & budget limits         | P2       | Fixed & Tested | Step 5 | `1f80bfb` |
| S13 | Security | Signup-based platform-admin promotion             | P0       | Fixed & Tested | Step 7 | `50a11c7` |
| S14 | Security | Member removal deletes owned accounts and history | P0       | Fixed & Tested | Step 7 | `2a7e050` |
| F13 | Finance  | Currency change without rate corrupts budgets     | P1       | Fixed & Tested | Step 7 | `d72ad4e` |
| OPS | Ops      | Console mail transport allowed in production      | P1       | Fixed & Tested | Step 7 | `ae6dccb` |
| OPS | Ops      | CI formatting gate fails on 155 files             | P2       | Fixed & Tested | Step 7 | `e46689b` |

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

- **Status**: Fixed & Tested (`1a0bfa6`)
- **Issues Addressed**:
  - **S09 (P2)**: Dependency vulnerability resolution (`drizzle-orm@0.45.2`, `nodemailer@10.0.1`, 0 vulnerabilities in `npm audit`).
  - **S08 (P2)**: Forwarding metadata & input length bounds (`TRUST_PROXY` check in `requestMeta()`, user agent length limit).
  - **Verification Gates**: Fixed React 19 SSR hook synchronization in `use-mobile.ts`, microtask state updates in `dashboard-customizer.tsx`, relative path navigation in `recent-transactions.tsx`.
  - **Production Mail Validation**: `createMailer()` fails closed when `MAIL_TRANSPORT=smtp` but `SMTP_URL` is omitted.
  - **Deployment Security Defaults**: `docker-compose.yml` binds PostgreSQL port `5432` and Web port `3000` to `127.0.0.1` (loopback).
  - **Migration Concurrency Reliability**: PostgreSQL session advisory lock (`pg_advisory_lock(849201948)`) wraps `migrateUp` and `migrateDownStep`.
  - **Queue Observability & Health Route**: Added `getQueueStats()` and surfaced queue/worker stats on `/api/health`.
  - **Runbooks & Operational Documentation**: Created [`docs/RUNBOOKS.md`](file:///C:/Users/Arun/Development/meridian/docs/RUNBOOKS.md).
- **Commit**: `1a0bfa6`

### Step 5: Remaining Security & Financial Remediation (S10–S12, F10–F12)

- **Status**: Fixed & Tested (`1f80bfb`)
- **Issues Addressed**:
  - **S10 (P2)**: Encrypted provider credentials in client props:
    - Hardened `listMeroShareConnections()` in `src/server/domain/meroshare.ts` to project a safe DTO containing only public connection metadata (`id`, `name`, `dpCode`, `dpName`, `lastSyncedAt`, `createdAt`).
    - Stripped sensitive ciphertext fields (`usernameEncrypted`, `passwordEncrypted`, `crnEncrypted`, `pinEncrypted`) before passing to React Server Components or client props.
  - **S11 (P2)**: Chat route CSRF, Origin/Sec-Fetch-Site validation, payload limits, and agent execution bounds:
    - In `src/app/api/chat/route.ts`, enforced `Content-Type: application/json`, rejected cross-origin and cross-site requests via `Origin` and `Sec-Fetch-Site` inspection, and enforced a 32KB raw payload limit.
    - In `src/server/ai/agent.ts`, enforced a total tool call quota (10 tool calls maximum per turn), a 60-second execution timeout, and capped assistant message responses at 4,000 characters.
  - **S12 (P2)**: Identity lifecycle, atomic invitation acceptance, token invalidation, and session revocation:
    - In `src/server/security/auth-tokens.ts`, implemented `invalidateUserTokens(exec, userId, purpose)`.
    - In `src/server/domain/invitations.ts`, wrapped invitation acceptance (`acceptInvitationForExistingUser` and `acceptInvitationWithNewAccount`) inside atomic transactions.
    - In `src/server/domain/users.ts`, wrapped `performPasswordReset` and `changeEmail` inside database transactions that revoke all active user sessions and invalidate outstanding auth tokens.
  - **F10 (P2)**: Sidebar vs dashboard report inclusion filter consistency:
    - In `src/app/(app)/layout.tsx`, filtered accounts with `a.includedInReports` before calling `netWorthMinorForAccounts`, ensuring sidebar net worth exactly matches the dashboard net worth figure.
  - **F11 (P2)**: Bigint / safe integer math in ledger and report aggregations:
    - In `src/server/domain/balances.ts` and `src/server/domain/reports.ts`, added `safeParseMinor`, `safeSubtract`, and `safeAdd` checking `Number.isSafeInteger()` to guard against floating-point precision loss and numeric overflows.
  - **F12 (P2)**: Currency change migration & budget limits conversion using FX rates:
    - In `src/server/domain/families.ts` (`updateFamilySettings`), looked up active budgets when family base currency is changed and converted their `amountMinor` using exchange rates (`getRate` and `convertMinor`).
- **Commit**: `1f80bfb`
- **Relevant Code Changes**:
  - [`src/server/domain/meroshare.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/meroshare.ts)
  - [`src/app/api/chat/route.ts`](file:///C:/Users/Arun/Development/meridian/src/app/api/chat/route.ts)
  - [`src/server/ai/agent.ts`](file:///C:/Users/Arun/Development/meridian/src/server/ai/agent.ts)
  - [`src/server/security/auth-tokens.ts`](file:///C:/Users/Arun/Development/meridian/src/server/security/auth-tokens.ts)
  - [`src/server/domain/invitations.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/invitations.ts)
  - [`src/server/domain/users.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/users.ts)
  - [`src/app/(app)/layout.tsx`](<file:///C:/Users/Arun/Development/meridian/src/app/(app)/layout.tsx>)
  - [`src/server/domain/balances.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/balances.ts)
  - [`src/server/domain/reports.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/reports.ts)
  - [`src/server/domain/families.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/families.ts)
  - [`tests/integration/step5-remediation.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/step5-remediation.test.ts)
- **Regression Tests & Verification Results**:
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 errors.
  - `npx vitest run tests/integration/step5-remediation.test.ts`: 8/8 tests passed.
  - `npm test`: 23 test files passed, 141/141 tests passed.
  - `npm run build`: Next.js Turbopack production build succeeded cleanly.

### Step 7: Release Blockers — Admin Promotion, Member Removal, Currency Integrity, Mail, Formatting (S13, S14, F13, OPS)

- **Status**: Fixed & Tested (`50a11c7`, `2a7e050`, `d72ad4e`, `ae6dccb`, `e46689b`)
- **Issues Addressed**:
  - **S13 (P0)**: Signup-based platform-admin promotion:
    - `registerUserWithFamily` and `markEmailVerified` never grant `super_admin`, regardless of `ADMIN_EMAILS` or the email-verification setting.
    - Operator-only flow: `grantPlatformAdmin`/`revokePlatformAdmin` in `src/server/domain/users.ts`, exposed as `npm run admin:promote -- <email> [--demote]`. Grants require proven inbox ownership (a previously consumed email-verification or password-reset token); otherwise a one-time verification link is issued and nothing is granted. `ADMIN_EMAILS` now only blocks those addresses from family invitations.
  - **S14 (P0)**: Member-removal data loss:
    - Migration `0005_member_removal` adds `users.removed_at`; `removeMember` deactivates the account instead of deleting it, preserving owned accounts (including private ones), entries, balances, transfers, and audit history under the deactivated owner.
    - Sessions, auth tokens, and account shares (granted to and on accounts of the member) are revoked; removed members cannot sign in, be promoted, or accept invitations; re-inviting their email and accepting the emailed link reactivates the account. Family admins cannot remove platform super-admins.
  - **F13 (P1)**: Currency-change integrity:
    - A currency change with active budgets but no available exchange rate is rejected with an actionable validation error; conversion of active budgets and the currency update run in a single transaction; superseded (inactive) budget rows are left untouched.
  - **OPS (P1)**: Production mail fail-closed:
    - `createMailer` refuses console transport when `NODE_ENV=production` and requires `SMTP_URL` and `MAIL_FROM` for production SMTP; `/api/health` reports `mail.ready=false` and a degraded status with the issue; docker-compose requires the mail settings explicitly and passes `MAIL_FROM` through.
  - **OPS (P2)**: CI formatting gate:
    - Whole-tree Prettier format; `npm run format:check` clean.
- **Regression Tests & Verification Results**:
  - `npm run lint`, `npm run typecheck`, `npm run format:check`: clean.
  - `npm test`: 26 files, 161/161 tests passed (new suites: S13 promotion guards, S14 member-removal, F13 currency-change, mailer production configuration).
  - `NODE_ENV=production npm run build`: succeeded.
- **Remaining operator tasks before public launch** (tracked in `docs/PRODUCTION_READINESS_CHECKLIST.md`): configure and verify real SMTP delivery end-to-end, plus the Cloudflare architecture decision, backup/restore drill, and browser acceptance testing.
