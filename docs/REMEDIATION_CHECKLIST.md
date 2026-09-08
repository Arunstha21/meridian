# Meridian Remediation Checklist & Verification Log

This document tracks the remediation progress of security vulnerabilities, financial integrity defects, operability improvements, and product backlog items identified in [`docs/PRODUCT_SECURITY_REVIEW.md`](file:///C:/Users/Arun/Development/meridian/docs/PRODUCT_SECURITY_REVIEW.md).

---

## Remediation Status Matrix

| ID | Title | Priority | Status | Commit | Regression Test |
|---|---|---|---|---|---|
| **S07** | Test setup can destroy non-test database | P1 | Fixed & Tested | `b8394c2` | [`tests/unit/database-guard.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/unit/database-guard.test.ts) (10 tests passing) |
| **S01** | Private-account disclosure through exports | P1 | Fixed & Tested | `db120a6` | [`tests/integration/reports-export.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/reports-export.test.ts) |
| **S02** | Platform-admin escalation via invitations/signup | P1 | Fixed & Tested | `db120a6` | [`tests/integration/security-fixes.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/security-fixes.test.ts) |
| **S03** | Member removal converts private accounts into joint accounts | P1 | Fixed & Tested | `db120a6` | [`tests/integration/authorization.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/authorization.test.ts) |
| **S04** | Recurring-series reassignment without source-account permission | P1 | Fixed & Tested | `db120a6` | [`tests/integration/authorization.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/authorization.test.ts) |
| **S05** | Authenticated financial pages cached by service worker | P1 | Fixed & Tested | `db120a6` | Verified in [`public/sw.js`](file:///C:/Users/Arun/Development/meridian/public/sw.js) |
| **S06** | Missing email-verification checks at mutation/API boundaries | P1 | Fixed & Tested | `db120a6` | [`tests/integration/security-fixes.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/security-fixes.test.ts) |
| **S08** | In-memory session tracking desynchronized across multiple instances | P2 | Queued | Pending | TBD |
| **S09** | Vulnerabilities in Drizzle ORM and Nodemailer | P2 | Queued | Pending | Dependency audit / `npm audit` |
| **S10** | Timing side-channels in token comparisons | P2 | Queued | Pending | Unit tests |
| **S11** | Chat proposal injection and lack of prompt sandboxing | P2 | Queued | Pending | Integration tests |
| **S12** | CSP and security headers missing or lax | P2 | Queued | Pending | Integration / unit tests |
| **F01** | Split invariants across edits, deletions, and nested operations | P1 | Queued | Pending | [`tests/integration/ledger.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/ledger.test.ts) |
| **F02** | Transfer invariants across edits, linking, splitting, and deletion | P1 | Queued | Pending | [`tests/integration/transfers-balances.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/transfers-balances.test.ts) |
| **F03** | Closed-account mutation rules | P1 | Queued | Pending | [`tests/integration/ledger.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/ledger.test.ts) |
| **F04** | Silent balance-recalculation failure for histories exceeding 4,000 days | P1 | Queued | Pending | [`tests/integration/transfers-balances.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/transfers-balances.test.ts) |
| **F05** | FX conversion across currencies with different decimal exponents | P1 | Queued | Pending | [`tests/unit/money.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/unit/money.test.ts) |
| **F06** | Hardcoded two-decimal assumptions in forms and charts | P2 | Queued | Pending | Unit tests |
| **F07** | Liability signs in opening balances and valuations | P2 | Queued | Pending | Integration tests |
| **F08** | Atomic, concurrency-safe balance recalculation | P2 | Queued | Pending | Integration tests |
| **F09** | Visible warnings for incomplete/stale FX totals | P2 | Queued | Pending | Unit / integration tests |
| **F10** | Incomplete reversal during multi-leg transfer adjustments | P2 | Queued | Pending | Integration tests |
| **F11** | Missing audit trail for critical financial changes | P2 | Queued | Pending | Integration tests |
| **F12** | Unbounded date queries and report aggregation timeouts | P2 | Queued | Pending | Integration tests |

---

## Detailed Remediation Log

### Step 1: S07 — Test setup can destroy non-test database
- **Status**: Fixed & Tested (`b8394c2`)
- **Relevant Code Changes**:
  - Created [`tests/setup/database-guard.ts`](file:///C:/Users/Arun/Development/meridian/tests/setup/database-guard.ts): Implemented `assertSafeTestDatabase`, `normalizeDbUrl`, and `quoteIdentifier`. Validates database names against safe identifier syntax (`^[a-zA-Z0-9_]{1,63}$`), blocks system databases (`postgres`, `template0`, `template1`), requires explicit test designation (containing `test` or `review`), forbids test URL pointing to the application database, and safely quotes identifiers.
  - Updated [`tests/setup/env.ts`](file:///C:/Users/Arun/Development/meridian/tests/setup/env.ts): Guarantees that `DATABASE_URL` is unconditionally routed to the validated `TEST_DATABASE_URL` before test clients/migrations import. If `TEST_DATABASE_URL` is unset, deletes `DATABASE_URL` to prevent tests hitting production/development data.
  - Updated [`tests/setup/global.ts`](file:///C:/Users/Arun/Development/meridian/tests/setup/global.ts): Safely provisions the isolated test database, uses quoted SQL identifiers with force drop, runs migrations against the isolated test database, and closes the pool connection.
  - Updated [`tests/helpers.ts`](file:///C:/Users/Arun/Development/meridian/tests/helpers.ts): Added guard assertion before `truncateAll()` and client creation.
  - Updated [`.env.test`](file:///C:/Users/Arun/Development/meridian/.env.test): Pointed test database URLs to isolated review database on port 55439.
  - Updated [`.github/workflows/ci.yml`](file:///C:/Users/Arun/Development/meridian/.github/workflows/ci.yml): Set `DATABASE_URL` and `TEST_DATABASE_URL` to test database and specified sentinel application DB.
- **Regression Tests**:
  - Added [`tests/unit/database-guard.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/unit/database-guard.test.ts) covering absent URLs, malformed formats, system database targeting, missing test designations, matching application database collision, and SQL injection in identifiers.
- **Verification Results**:
  - `npx vitest run tests/unit/database-guard.test.ts`: 10/10 passed.
  - Full suite (`npm test`): 20 test files passed, 107/107 tests passed against isolated review cluster on port 55439.
- **Remaining Limitations or Decisions**: None. Production/application databases are completely protected.

---

### Step 2: S01–S06 — Security and Access Control Remediation
- **Status**: Fixed & Tested (`db120a6`)
- **Issues Addressed**:
  - **S01 (P1)**: Private-account disclosure through exports. Restrict `buildFamilyExport` to accounts visible to the requesting actor (`listAccountsForActor`). Exclude private accounts owned by other members and their entries, tag links, and shares. Reject unverified actors in `/api/export` when verification is enforced.
  - **S02 (P1)**: Platform-admin escalation through invitations/signup. Disallow invitations directed to addresses configured in `ADMIN_EMAILS`. Block auto-escalation to `super_admin` upon invitation acceptance (must always be assigned `user`). Require email verification before auto-granting `super_admin` on registration, and only promote to `super_admin` inside `markEmailVerified` once confirmed.
  - **S03 (P1)**: Member removal silently converting private accounts into joint accounts. When removing a member in `removeMember`, delete private accounts owned by the departing member in the same transaction to prevent them from becoming orphaned or shared without permission.
  - **S04 (P1)**: Recurring-series reassignment without source-account management permission. Validate that the requesting actor has `manage` permission on both the source account and target account when reassigning `accountId` in `updateSeries`. Prevent reassigning across differing account currencies.
  - **S05 (P1)**: Authenticated financial pages cached by service worker. Bumped cache to `meridian-static-v2` and dropped shell navigation caching. Enforced that only public static immutable assets (`/_next/static/`, `.svg`, `.png`, `.webmanifest`, `.ico`) are cached. Explicitly bypassed cache for navigations, APIs, RSC requests, and server actions. Added cache purging on `activate` for obsolete `meridian-shell-v1` caches.
  - **S06 (P1)**: Missing email-verification checks at mutation/API boundaries. Added verification boundary enforcement in `assertActor()` so all 33 mutation server actions and API endpoints reject unverified users when `REQUIRE_EMAIL_VERIFICATION="true"`, while allowing callers to pass `allowUnverified: true` for verification token resend/flow.
- **Relevant Code Changes**:
  - [`src/server/domain/exports.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/exports.ts)
  - [`src/app/api/export/route.ts`](file:///C:/Users/Arun/Development/meridian/src/app/api/export/route.ts)
  - [`src/server/security/auth-tokens.ts`](file:///C:/Users/Arun/Development/meridian/src/server/security/auth-tokens.ts)
  - [`src/server/domain/invitations.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/invitations.ts)
  - [`src/server/domain/users.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/users.ts)
  - [`src/app/(app)/settings/actions.ts`](file:///C:/Users/Arun/Development/meridian/src/app/(app)/settings/actions.ts)
  - [`src/server/domain/recurring.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/recurring.ts)
  - [`src/server/auth/context.ts`](file:///C:/Users/Arun/Development/meridian/src/server/auth/context.ts)
  - [`src/lib/env.ts`](file:///C:/Users/Arun/Development/meridian/src/lib/env.ts)
  - [`public/sw.js`](file:///C:/Users/Arun/Development/meridian/public/sw.js)
  - [`tests/helpers.ts`](file:///C:/Users/Arun/Development/meridian/tests/helpers.ts)
- **Regression Tests**:
  - [`tests/integration/reports-export.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/reports-export.test.ts): Verified S01 (private accounts excluded from export).
  - [`tests/integration/security-fixes.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/security-fixes.test.ts): Verified S02 (rejection of platform admin invites, denial of escalation upon invitation acceptance, verification requirement for super_admin promotion) and S06 (unverified mutation blockage).
  - [`tests/integration/authorization.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/authorization.test.ts): Verified S03 (purging private accounts on member removal) and S04 (source and target account authorization checks and cross-currency protection on recurring series).
- **Verification Results**:
  - `npm run typecheck`: Passed with 0 errors.
  - `npm test`: 21 test files passed, 115/115 tests passed against isolated review cluster on port 55439.
- **Remaining Limitations or Decisions**: None for priority access controls S01–S06. S08–S12 queued for subsequent remediation.
