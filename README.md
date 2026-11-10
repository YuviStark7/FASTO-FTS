# FASTO FTS — Food Trend Scout

Market intelligence for quality food products: for one product category in one territory (a *cell*), FASTO FTS says whether there is room to grow, why, and how to enter. Every figure carries a grade (A measured, B model estimate, C exploratory signal) and links to its source.

The specification is [`docs/SPEC.md`](docs/SPEC.md). Decisions are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md), progress in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run locally

Requirements: Node 22, pnpm 10, Docker.

```bash
pnpm install
pnpm exec supabase start      # local Postgres, Auth and REST, migrations applied
cp .env.example .env.local    # fill from `pnpm exec supabase status`
pnpm dev
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test   # TypeScript, ESLint, Vitest
pnpm db:test                               # pgTAP RLS tests
pnpm build && pnpm test:e2e                # Playwright at 390 px and 1440 px
```
