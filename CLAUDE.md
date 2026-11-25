# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WMS Pro: a warehouse management system (lots, expiry, FEFO picking, 2D warehouse map, stocktaking, reports). One Cloudflare Worker serves the React SPA (Workers Static Assets) and a Hono REST API (`/api/*`) backed by D1 and R2, on the free plan. UI text is Vietnamese via i18next (`src/locales/{vi,en}/translation.json`); every code identifier, table, column and endpoint is English.

## Commands

```bash
npm run dev            # Vite + Worker (workerd) + local D1/R2 via @cloudflare/vite-plugin
npm run setup          # db:migrate:local + db:seed:local (first run)
npm test               # Vitest: tests/unit (pure domain) + tests/integration (real migrations on better-sqlite3)
npx vitest run tests/unit/fefo.test.ts   # single file; add -t "<name>" for one test
npm run typecheck      # tsc -b over tsconfig.app/worker/node
npm run lint
npm run build          # typecheck + vite build -> dist/client (SPA) + dist/warehouse_management (worker)
npm run deploy         # build + wrangler deploy (always build first; wrangler uses the generated config)
npm run db:reset:local # regenerate demo data for today's date and reload it
npm run cf-typegen     # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

Node >= 22.12 (on this machine at `~/.local/node/bin`).

## Architecture

- Layers: `src/backend/routes` (Zod validation, envelope) → `services` (business rules) → `repositories` (interfaces + SQL, always filtered by `tenant_id`) → `adapters` (`SqlDatabase` ← D1, `StorageProvider` ← R2). `domain/` holds pure logic (FEFO, expiry buckets, Vietnam business date, location codes, `AppError`). Only `container.ts`/`adapters/` know about Cloudflare. `createApp(containerFactory)` lets tests inject a SQLite-backed container.
- `src/shared/` (constants incl. `ROLE_PERMISSIONS`, Zod schemas, API DTO types) is imported by both the SPA and the Worker; form validation and server validation use the same schemas.
- Integrity without interactive transactions: every stock-changing operation is ONE `db.batch()` (`services/tx.ts#runAtomic`). Correctness relies on DB constraints/triggers in `database/migrations/0001_init.sql`: `CHECK (quantity >= 0)` on `inventory_balances`, capacity triggers, document status triggers, `UNIQUE(reference_item_id, transaction_type)` on the ledger, `UNIQUE(tenant_id, request_key)` on issues, plus guard statements in `repositories/operations.ts#ledger`. Do not remove these; `mapDatabaseError` maps their messages to error codes.
- Inventory key is product + lot + bin (`inventory_balances`). Lot quantity is never stored; it is the sum of balances. Every movement writes an `inventory_transactions` row.
- FEFO runs server-side at confirmation (`services/issues.ts`); the preview fingerprint detects stock changes (`STOCK_CHANGED`).
- Expiry status is computed at query time from the Asia/Ho_Chi_Minh business date (`domain/dates.ts`, `domain/expiry.ts`); expiry date <= today counts as expired. No cron jobs.
- Auth: PBKDF2 (iterations from `PASSWORD_HASH_ITERATIONS`, rehash on login), HttpOnly session cookie whose HMAC is the `sessions.id`, CSRF token header on every mutation, login rate limit in D1. Every route declares `requirePermission(...)`; the SPA's `can()` only hides UI.
- Demo data: `src/backend/seed/demoData.ts` is the single generator used by `scripts/generate-seed.ts` and `POST /api/demo/reset`; deterministic ids + `INSERT OR IGNORE` keep it idempotent.
- Frontend: never hard-code visible text, add keys to both locale files. API errors are shown via `useErrorMessage` (`errors.<CODE>`). API base URL is `VITE_API_BASE_URL` (empty = same origin).
- Schema changes: add a new file in `database/migrations/`, apply `--local` and `--remote`; keep integration tests passing (they execute the migrations).
- When adding an endpoint, also register it in `src/backend/openapi.ts`.

Docs live in `docs/` (ARCHITECTURE, DATABASE, API, DEPLOYMENT, DOMAIN_MIGRATION, FREE_TIER_LIMITS, SECURITY, USER_GUIDE).
