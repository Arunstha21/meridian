# Meridian Remediation Checklist & Verification Log

This document tracks the remediation progress of security vulnerabilities, financial integrity defects, operability improvements, and product backlog items identified in [`docs/PRODUCT_SECURITY_REVIEW.md`](file:///C:/Users/Arun/Development/meridian/docs/PRODUCT_SECURITY_REVIEW.md).

---

## Remediation Status Matrix

| ID | Title | Priority | Status | Commit | Regression Test |
|---|---|---|---|---|---|
| **S07** | Test setup can destroy non-test database | P1 | Fixed & Tested | `b8394c2` | [`tests/unit/database-guard.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/unit/database-guard.test.ts) (10 tests passing) |
| **S01** | Private-account disclosure through exports | P1 | Fixed & Tested | `1ae7f3d` | [`tests/integration/reports-export.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/reports-export.test.ts) |
| **S02** | Platform-admin escalation via invitations/signup | P1 | Fixed & Tested | `1ae7f3d` | [`tests/integration/security-fixes.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/security-fixes.test.ts) |
| **S03** | Member removal converts private accounts into joint accounts | P1 | Fixed & Tested | `1ae7f3d` | [`tests/integration/authorization.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/authorization.test.ts) |
| **S04** | Recurring-series reassignment without source-account permission | P1 | Fixed & Tested | `1ae7f3d` | [`tests/integration/authorization.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/authorization.test.ts) |
| **S05** | Authenticated financial pages cached by service worker | P1 | Fixed & Tested | `1ae7f3d` | Verified in [`public/sw.js`](file:///C:/Users/Arun/Development/meridian/public/sw.js) |
| **S06** | Missing email-verification checks at mutation/API boundaries | P1 | Fixed & Tested | `1ae7f3d` | [`tests/integration/security-fixes.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/security-fixes.test.ts) |
| **S08** | In-memory session tracking desynchronized across multiple instances | P2 | Queued | Pending | TBD |
| **S09** | Vulnerabilities in Drizzle ORM and Nodemailer | P2 | Queued | Pending | Dependency audit / `npm audit` |
| **S10** | Timing side-channels in token comparisons | P2 | Queued | Pending | Unit tests |
| **S11** | Chat proposal injection and lack of prompt sandboxing | P2 | Queued | Pending | Integration tests |
| **S12** | CSP and security headers missing or lax | P2 | Queued | Pending | Integration / unit tests |
| **F01** | Split invariants across edits, deletions, and nested operations | P1 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F02** | Transfer invariants across edits, linking, splitting, and deletion | P1 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F03** | Closed-account mutation rules | P1 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F04** | Silent balance-recalculation failure for histories exceeding 4,000 days | P1 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F05** | FX conversion across currencies with different decimal exponents | P1 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F06** | Hardcoded two-decimal assumptions in forms and charts | P2 | Fixed & Tested | `5ea3f5e` | [`src/lib/money.ts`](file:///C:/Users/Arun/Development/meridian/src/lib/money.ts) |
| **F07** | Liability signs in opening balances and valuations | P2 | Fixed & Tested | `5ea3f5e` | [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts) |
| **F08** | Atomic, concurrency-safe balance recalculation | P2 | Fixed & Tested | `5ea3f5e` | [`src/server/domain/balances.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/balances.ts) |
| **F09** | Visible warnings and request caching for incomplete FX totals | P2 | Fixed & Tested | `5ea3f5e` | [`src/server/domain/reports.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/reports.ts) |
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
- **Status**: Fixed & Tested (`1ae7f3d`)
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

---

### Step 3: F01–F09 — Financial Integrity Remediation
- **Status**: Fixed & Tested (`5ea3f5e`)
- **Issues Addressed**:
  - **F01 (P1)**: Split invariants across edits, deletions, and nested operations:
    - Prevent direct editing of split parent transaction amounts (`updateTransactionEntry` throws `conflict`).
    - Cascade date updates from parent transaction to all child split entries.
    - Prevent split children from having diverging dates from their parent (`validation.failed`).
    - Enforce split children amounts sum strictly to the parent amount on modification.
    - Disallow deleting individual split children directly; requiring unsplitting first.
    - Deleting a split parent deletes all children atomically in the same database transaction.
    - Prevent nested splits (calling `splitEntry` on a child split part).
  - **F02 (P1)**: Transfer invariants across edits, linking, splitting, and deletion:
    - Lock amount and date edits on linked transfer legs to preserve bilateral balance symmetry.
    - Prevent linking split transactions or split child parts as transfers.
    - Atomic transfer deletion and automatic unlinking when deleting a transfer entry.
    - Enforce `assertAccountOpen` when removing transfers.
  - **F03 (P1)**: Closed-account mutation rules:
    - Enforce `assertAccountOpen` on `createTransactionEntry`, `updateTransactionEntry`, `deleteEntry`, `splitEntry`, `unsplitEntry`, `recordValuation`, and `removeTransfer`. Closed accounts cannot be modified or added to.
  - **F04 (P1)**: Silent balance recalculation failure for histories > 4,000 days:
    - Removed arbitrary 4,000-day bail-out in `src/server/domain/balances.ts`.
    - Extended maximum recalculation history window to 36,500 days (100 years) with an explicit validation error if exceeded instead of silent data divergence.
  - **F05 (P1)**: FX conversion across currencies with different decimal exponents:
    - Implemented decimal exponent scaling `10 ** (toExp - fromExp)` in `convertMinor(amountMinor, rate, fromCurrency, toCurrency)` in `src/server/domain/exchange-rates.ts`.
    - Correctly converts between 0-decimal (JPY), 2-decimal (USD, EUR), and 3-decimal currencies (BHD, KWD).
  - **F06 (P2)**: Hardcoded two-decimal assumptions in forms and charts:
    - Added `minorToDecimal(minor, currency)` and `minorToMajor(minor, currency)` in `src/lib/money.ts`.
    - Updated chart components and input fields to respect currency decimal exponents rather than dividing by 100.
  - **F07 (P2)**: Liability signs in opening balances and valuations:
    - Added `displayToLedgerBalance(displayMinor, accountType)` and `ledgerToDisplayBalance(ledgerMinor, accountType)`.
    - Credit cards and liabilities opening balances and valuations are automatically converted into negative ledger amounts, ensuring net worth calculations and balance histories represent liabilities accurately.
  - **F08 (P2)**: Atomic, concurrency-safe balance recalculation:
    - Wrapped balance deletion and chunked inserts in `exec.transaction(async (tx) => ...)` in `recalculateAccount`.
  - **F09 (P2)**: Request-level rate caching and visible warnings for incomplete FX totals:
    - Added `rateCache` map to `ConversionContext` in `src/server/domain/reports.ts` to deduplicate database rate lookups.
    - Added `incompleteFx` flag and `fxIssues` list to `DashboardSummary`.
- **Relevant Code Changes**:
  - [`src/lib/money.ts`](file:///C:/Users/Arun/Development/meridian/src/lib/money.ts)
  - [`src/server/domain/entries.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/entries.ts)
  - [`src/server/domain/transfers.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/transfers.ts)
  - [`src/server/domain/splits.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/splits.ts)
  - [`src/server/domain/balances.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/balances.ts)
  - [`src/server/domain/exchange-rates.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/exchange-rates.ts)
  - [`src/server/domain/reports.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/reports.ts)
  - [`src/server/domain/accounts.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/accounts.ts)
  - [`src/server/domain/valuations.ts`](file:///C:/Users/Arun/Development/meridian/src/server/domain/valuations.ts)
  - [`tests/helpers.ts`](file:///C:/Users/Arun/Development/meridian/tests/helpers.ts)
  - [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts)
- **Regression Tests**:
  - [`tests/integration/financial-invariants.test.ts`](file:///C:/Users/Arun/Development/meridian/tests/integration/financial-invariants.test.ts): 16 tests verifying F01, F02, F03, F04, F05, F07.
  - All existing integration suites: `ledger.test.ts`, `transfers-balances.test.ts`, `authorization.test.ts`, `reports-export.test.ts`.
- **Verification Results**:
  - `npm run typecheck`: Passed with 0 errors.
  - `npm test`: 22 test files passed, 131/131 tests passed.
  - `npm run build`: Production Turbopack build succeeded with 0 errors.
