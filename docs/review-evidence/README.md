# Review evidence

These files support [the product/security review](../PRODUCT_SECURITY_REVIEW.md).

- `existing-tests.txt`: existing Vitest suite, 97/97 passing in an isolated database.
- `database-probes.txt`: nine reproduced defects, using synthetic users and ledger entries.
- `database-probes.ts.txt`: exact probe source, saved as text so it does not enter the application or normal test build. These assertions verify the **defective current behavior**, not desired regression behavior.
- `review-runner.cjs.txt`: wrapper that runs tests/probes against a freshly named database and removes only that database afterward.
- `npm-audit.json`: dependency audit output; applicability is discussed in the report.

The runner used a **separate temporary PostgreSQL 16 cluster**, bound to `127.0.0.1:55439` with a synthetic `review_admin` role. It did not connect to the user's application database. Generated databases were removed after testing. The cluster was stopped after use; its inert files remain under the gitignored `.playwright-mcp/review-pg` directory.

To reproduce later, provision another isolated local cluster with those settings, copy the two source text files to `.playwright-mcp/review-runner.cjs` and `.playwright-mcp/review-probes.ts`, then run `node .playwright-mcp/review-runner.cjs` from the repository root. The scripts assume the repository's current schema and dependencies. Create/drop privileges are needed **on the disposable cluster only**. Remove temporary source files afterward so project-wide lint/typechecking does not pick them up. Convert the probes into proper failing regression tests as fixes are implemented.

Additional service-worker experiment: the real `public/sw.js` was executed in a Node VM with synthetic FetchEvent/cache/network implementations. A successful `/accounts` navigation containing `PRIVATE FINANCIAL FIXTURE` and `Cache-Control: no-store, private` was cached. A subsequent simulated network failure returned that same body. This proves the script's cache decision and fallback behavior; it is not an interactive browser logout test.

Other checks: typecheck and production build passed. Lint failed with two effect/state errors and one navigation warning. Prettier reported 142 files with formatting differences before these report files were added. Neither checker applied fixes.
