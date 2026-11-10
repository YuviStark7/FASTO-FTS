# FASTO FTS (Food Trend Scout): instructions for Claude Code

`docs/SPEC.md` is the single source of truth. This file condenses its sections 3 (fixed decisions), 4 (architecture) and 8 (build orchestration). If this file and the spec disagree, the spec wins.

## Five product rules (override everything)

1. Every number carries a grade: A measured, B model estimate, C exploratory signal. Stored with the value, shown beside it everywhere, exports included.
2. Missing data is never a low score. Insufficient data is visually distinct (hatched) and excluded from rankings.
3. The model never does arithmetic. Indices, trends and estimates come from versioned SQL/TypeScript in `lib/scoring`. LLMs classify, extract and write prose around numbers they are handed.
4. Every claim is traceable to source, date, method version and ingestion run. A brief sentence with a figure and no citation does not ship.
5. Keep the proposal's distinctions: nominal value vs volume, production vs consumption, online sentiment is never a representative sample.

Never invent market data. Seed data is real and sourced, or `is_demo = true` and shown with a DEMO badge.

## Fixed stack (do not reopen; if impossible, write why in `docs/DECISIONS.md` first)

- Next.js App Router, TypeScript strict. Tailwind v4 + shadcn/ui, tokens as CSS variables (dark default, light theme). Mobile first, PWA.
- Supabase (project `efuvmiaztmubhntezpca`, eu-central-1): Postgres, Auth (magic link, open sign-up + captcha), RLS, Storage, Edge Functions. PostGIS, pgvector, pg_cron.
- Heavy pipelines: Node scripts in `/pipelines`, run by scheduled GitHub Actions.
- Runtime AI: Anthropic API from server code only. Sonnet for orchestration, briefs, chat. Haiku for bulk mention classification. Model ids live in config, never as literals in components.
- MapLibre GL, Recharts (wrapped in `components/charts`), PDF via print route, Word via `docx`.
- `next-intl`: Italian default, English available. No hard-coded user-visible strings.
- Vercel hosting (EU), preview per PR.
- Tests: Vitest (scoring, pipelines), Playwright at 390 px and 1440 px, pgTAP for RLS.

## Layout

```
/app            Next.js routes (it, en)
/components     ui, charts, map, cell, shell
/lib            scoring, queries, ai (tools, prompts), i18n, export
/pipelines      one folder per connector, shared normaliser
/supabase       migrations, seed, functions, tests
/docs           SPEC, DECISIONS, METHODS, SOURCES, PROGRESS
/.claude        agents, commands
```

## Conventions

- Every schema change is a migration file in `supabase/migrations`. No dashboard edits.
- Weights, thresholds and model ids live in config or DB rows (`method_versions`, `weight_sets`, `app_config`), never as literals in components.
- Secrets only in Vercel, GitHub and Supabase secret stores. The Anthropic key and Supabase service key never reach the browser (`server-only` imports).
- `main` is protected. Work lands via PR with green checks (typecheck, lint, Vitest, pgTAP, Playwright).
- Migrations go to the Supabase dev branch first; production only gets merged migrations. No destructive SQL without a backup step.

## Architecture

Ingest (connector → raw file in Storage with hash → `source_runs`) → Normalise (→ `observations` with grade, source, run, method version) → Compute (deterministic snapshots: trend, geo, CSI, MOS, each storing inputs and method version) → Narrate (advisor writes the brief, every figure cites existing observation ids) → Serve (pages read views; browser computes only what-if weight re-ranking).

Runtime agents: an orchestrator routes to six module agents (01 Data Scout, 02 Trend Analyzer, 03 Geo Market, 04 Consumer Feeling, 05 Competition Scout, 06 Opportunity Advisor). Each is a server function with a fixed prompt in `lib/ai/prompts` (versioned, with eval fixtures), typed tools and a JSON output schema. The chat never writes SQL: it calls `get_cell`, `rank_opportunities`, `compare_territories`, `get_levers`, `get_sources`. A post-check rejects answers whose numbers are not in tool results, retries once, then says the data is not available.

Auth and roles: roles on `memberships` (admin, analyst, member, viewer), never in user-editable metadata. New users get a personal org and Member. Only admins change roles, audited. AI caps per user per day (20 chat turns, 3 briefs) plus global daily spend limit and kill switch, all in `app_config`.

Compliance: no consumer personal data; mentions are short excerpts with author ids stripped at ingestion. Account export and delete. Append-only `audit_log` for weights, sources, roles, briefs.

## Build orchestration

Lead (Opus) owns planning, schema, migrations, RLS, scoring methods, runtime prompts and tool contracts, PR review, merges and `DECISIONS.md`. Sub agents in `.claude/agents/`: `ui-builder`, `connector-builder`, `test-writer`, `reviewer` (Sonnet); `scout`, `seeder` (Haiku).

Task loop: lead writes a task card (goal, files, contract, acceptance check, do-not-touch) → sub agent works on `day-N/short-name` (own worktree when parallel) → returns summary + diff + test output → `reviewer` checks → lead merges → lead updates `docs/PROGRESS.md`. Up to five parallel agents, only on disjoint files. Schema work is serial and lead-only.

Cost control: cache mention scores by content hash, batch Haiku calls, cap tokens per chat turn, log spend per module in `usage`.

## Schedule

Release is fixed: Sunday 15 November 2026. If a day gate slips, cut in this order (log in `docs/HANDOVER.md`): PWA offline caching → product passport → Word export → map → light theme → GDELT → English strings. Never cut: RLS and its tests, grades on every figure, citation check, insufficient data state, usage caps, mobile layout of Scout and cell sheet.
