# dracinhubv2

Multi-provider short drama aggregator (Next.js + Supabase + Upstash) with 41 active providers from `api-endpoints.json`.

## Current MVP Verification Status

Verified on 2026-02-26:

- `npm run test` -> PASS (`288/288`)
- `npm run test` -> PASS (`297/297`)
- `npm run lint` -> PASS (`tsc --noEmit`)
- `npm run build` -> PASS (Next.js 16 production build)
- `npm run probe:providers` -> report generated at `reports/provider-probe-latest.json`
- `npm run analyze:homepage` -> report generated at `reports/homepage-analysis-latest.json`

## Key Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run verify
npm run probe:providers
npm run analyze:homepage
```

## Environment

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`
- `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`
- `CAPTAIN_API_TOKEN`

## MVP Run Flow

1. Apply schema and migration:
   - `DB_SCHEMA.sql`
   - `migrations/001_initial_schema_constraints.sql`
2. Sync providers:
   - `npx ts-node src/jobs/sync-providers.ts`
3. Sync home data:
   - `npx ts-node src/jobs/sync-home-dramas.ts`
4. Sync episodes per drama:
   - `npx ts-node src/jobs/sync-episodes.ts <provider> <dramaId>`
5. Run readiness probe + homepage analysis:
   - `npm run probe:providers`
   - `npm run analyze:homepage`

## Notes

- Build no longer depends on Google Font fetch at build-time.
- Adapter entrypoints for Golden-5 compatibility:
  - `src/lib/providers/adapters/reelshort.ts`
  - `src/lib/providers/adapters/goodshort.ts`
  - `src/lib/providers/adapters/flextv.ts`
- Diagnostics endpoint:
  - `GET /api/v1/home/diagnostics`
- Provider probe runbook: `docs/runbooks/provider-probe.md`
