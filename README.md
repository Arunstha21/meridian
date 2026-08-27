# Meridian

Self-hosted personal finance ledger. Know exactly where you stand.

Meridian is a Next.js implementation of the core personal-finance contract described in the
Sure clone plan: family-scoped accounts, a typed double-sided ledger with transfers and splits,
materialized daily balances, server-owned reporting, durable background jobs, and rigorous
authorization, a guarded Sure-data migration, direct CDSC MeroShare portfolio sync, and optional AI surfaces.

## Stack

| Concern    | Choice                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| Framework  | Next.js (App Router) + React + TypeScript (strict)                                      |
| Database   | PostgreSQL 16+ via Drizzle ORM; reviewed SQL migrations                                 |
| Auth       | In-house sessions (scrypt passwords, hashed opaque tokens, revocation)                  |
| Queue      | PostgreSQL-backed worker process (`FOR UPDATE SKIP LOCKED`, retries, dead-letter, cron) |
| Validation | Zod at action boundaries; domain invariants enforced in services                        |
| UI         | Tailwind CSS v4 with semantic design tokens                                             |
| Tests      | Vitest unit + integration against real Postgres                                         |

## Requirements

- Node.js 22+
- PostgreSQL 16+ (local, Homebrew service, or `docker compose up -d db`)

## Getting started

```bash
npm install
cp .env.example .env.local            # adjust DATABASE_URL / APP_URL if needed
npm run db:migrate                    # apply SQL migrations
SEED_DEMO=true npm run db:seed        # optional demo household
npm run dev                           # web app on http://localhost:3000
npm run worker                        # background jobs (separate terminal)
```

The demo seed creates `demo@meridian.local` with password `meridian-demo-2026`
(override with `SEED_PASSWORD`). Grant platform super-admin by adding your email to
`ADMIN_EMAILS` before signing up, or promote directly in the database.

## Scripts

| Command                                       | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `npm run dev`                                 | Web app in development mode                         |
| `npm run build` / `npm start`                 | Production build and serve                          |
| `npm run worker`                              | Background job runner (emails, maintenance crons)   |
| `npm run db:migrate`                          | Apply pending migrations                            |
| `npm run db:migrate:down`                     | Revert the most recent migration                    |
| `npm test`                                    | Unit + integration tests (needs reachable Postgres) |
| `npm run lint` / `typecheck` / `format:check` | CI checks                                           |

## Environment

See `.env.example`. Everything is validated at boot (`src/lib/env.ts`) — the process refuses to
start with missing or malformed configuration. No secrets are ever committed or logged;
sensitive keys are redacted by the logging helper.

MeroShare is optional and requires `MERO_SHARE_ENCRYPTION_KEY` (a 32-byte base64 key) before a CDSC login can be saved. Meridian encrypts the username and password at rest, while the CDSC authorization header exists only for the in-flight sync.

## Testing

```bash
TEST_DATABASE_URL=postgres://.../meridian_test npm test
```

The global setup recreates the test database from scratch each run (drop → create → migrate),
so suites are hermetic. Integration tests cover cross-family denial, the account-share
permission matrix, transfer atomicity/retry, split invariants, balance recalculation, FX
fallback behavior, queue retry/dead-letter/cron semantics, and audit trails.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module layout, data model, sign conventions
- [DECISIONS.md](./DECISIONS.md) — scope decisions mapped from the source clone plan
- [SECURITY.md](./SECURITY.md) — threat model summary and controls
- [docs/upstream-sync-state.md](./docs/upstream-sync-state.md) — reviewed source baseline

## License notes

Meridian is an independent implementation inspired by behavioral documentation of the Sure
project (AGPLv3 fork of Maybe Finance). No source code was copied; verify attribution
obligations with legal counsel before distributing.
