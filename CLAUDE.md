# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WarehouseManagement is a warehouse management web app (products, stock in/out, inventory), built with Next.js 15 (App Router), React 19, TypeScript (strict) and Tailwind CSS v4, running on Cloudflare Workers with D1. All UI text is in Vietnamese; money is integer VND formatted with `formatPrice`, quantities with `formatNumber` (`src/lib/format.ts`).

The project is currently only a skeleton: no schema, no business features yet.

## Commands

```bash
npm install
npx wrangler d1 migrations apply DB --local   # apply local D1 migrations (once migrations exist)
npm run dev         # dev server at http://localhost:3000
npm run build       # production build (also type-checks)
npm run lint        # next lint (ESLint 9 flat config via FlatCompat)
npm run typecheck   # tsc --noEmit
npm run preview     # OpenNext build + run on local workerd (Cloudflare runtime)
npm run deploy      # OpenNext build + deploy to Cloudflare Workers
npm run cf-typegen  # regenerate cloudflare-env.d.ts after changing wrangler.jsonc or .dev.vars keys
```

Requires Node >= 22.12 (Wrangler). There is no test framework set up yet.

## Architecture

- **Design system.** Tailwind v4 `@theme` tokens in `src/app/globals.css` (`brand`, `brand-dark`, `brand-50`, `ink`) plus the Be Vietnam Pro font from `layout.tsx`. Use `bg-brand`/`text-brand`, do not hard-code colors.
- **Layout.** `src/app/layout.tsx` holds only the font and CSS; pages wrap content in `mx-auto max-w-7xl px-4`.
- **Data layer: Cloudflare D1** (binding `DB`). All DB access goes through `src/server/`; `getDb()`/`getEnv()` in `src/server/db.ts` use `getCloudflareContext`. In `next dev`, `initOpenNextCloudflareForDev` (in `next.config.ts`) provides local D1 (`.wrangler/state`) and `.dev.vars`. Schema changes go in a new file under `migrations/`, applied with `--local` and with `--remote` before deploy. Map snake_case rows to camelCase types.
- **Next 15 async params.** `params` and `searchParams` are Promises and must be awaited.
- `@/*` resolves to `src/*`.

## Deployment (Cloudflare Workers, free plan)

- Uses `@opennextjs/cloudflare`; config in `wrangler.jsonc` (worker `warehouse-management`) and `open-next.config.ts`. Always deploy via the npm scripts, not raw `wrangler deploy`.
- Before the first remote deploy: `npx wrangler d1 create warehouse-management-db` and put the returned id into `wrangler.jsonc` (currently a placeholder).
- The incremental cache is `static-assets-incremental-cache` (read-only, no ISR); pages reading D1 should be `force-dynamic`.
- Free plan limits: about 10ms CPU per request and 3 MiB gzip worker size.
