# Upstream Sync State

Per the source playbook, markers advance only after individual decisions are recorded.

| Track | Reference | Reviewed through | Date |
| --- | --- | --- | --- |
| Canonical Sure | github.com/we-promise/sure (upstream/main) | 914547ffdbaae45c1eb5bcc7045b05e968e83c3c | 2026-08-12 |
| Local extension | Arunstha21/sure-finance dev-upstream-sync | c44408ffed6b312f4418f73558528c207d637515 | 2026-08-12 |

## Initial import decisions

| Extension group | Decision |
| --- | --- |
| Shared Expenses | Rejected for launch (distinct from transaction splits, which shipped) |
| MeroShare/CDSC + NEPSE | Rejected as one unit |
| Google AI Studio / assistant | Rejected |
| Loan receivables | Rejected (loan account type not launched) |
| Low-memory mode | Deferred; worker/web split keeps memory profile small by default |
| Import reliability fixes | N/A until CSV import ships; external-id dedupe index pre-provisions idempotency |

## Review cadence

Weekly bounded review per the source playbook. Security advisories are handled immediately.
