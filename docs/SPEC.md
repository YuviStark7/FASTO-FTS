# FASTO FTS: Web Platform Build Specification and Roadmap

Nov 10, 2026 · @Yuvi

## 1. How to use this document

This is the single source of truth for building FASTO FTS (Food Trend Scout), a responsive web platform for market intelligence on quality food products. It is written for Claude Code with Opus 5.5 as lead and Sonnet and Haiku as sub agents.

Rules for the lead agent:

1. Read the whole document before writing code. Then copy it into the repo as `docs/SPEC.md` and create `CLAUDE.md` from sections 3, 4 and 8.
2. Decisions in section 3 are final. Do not reopen them. If one proves impossible, stop and write the reason in `docs/DECISIONS.md` before choosing an alternative.
3. Build in the day order of section 10. The release date is fixed: Sunday 15 November 2026. If a day gate slips, cut scope using the cut order in section 10. Never move the date.
4. Where this document is silent, choose the simplest option that respects the five product rules in section 2, and log the choice in `docs/DECISIONS.md`.
5. Never invent market data. Seed data must be either real and sourced, or clearly flagged `is_demo = true` and shown with a DEMO badge in the interface.
6. The decisions in section 11 were confirmed by the project owner on 10 November 2026. Treat them as final.

Source material: the project proposal `FASTO TS.docx` (November 2026, in Italian) and the video `UI UX design inspiration.mp4`. Both sit in the `7. FASTO TS` folder. The proposal defines the product. The video defines a feeling, not a layout to copy.

## 2. Product definition

FASTO FTS tells a small food producer, a consortium or a territorial body where a quality product has room to grow, why, and how to enter. The unit of analysis is the cell: one product category in one territory.

**Users.** Agri-food SMEs, protection consortia, producer organisations, GAL, development agencies, chambers of commerce, researchers. Most are not analysts. They need a verdict first and the evidence one tap away.

**Pilot perimeter.** 15 categories by 20 territories, so 300 cells. At least 30 cells get a full documented sheet. Categories: EVO oil, cheese, cured meats, pasta, bakery, cereals and legumes, preserves, processed fruit and vegetables, honey, traditional sweets, premium soft drinks, organic, coffee, chocolate, vinegar and condiments. Territories: 12 Italian cities and 8 European cities, chosen on Day 1 by data availability.

**What each cell answers.**

| Question | Output | Module |
| --- | --- | --- |
| How big is the market and where is it going? | Value in euro, volumes, price change, multi-year trend | 01 Data Scout, 02 Trend Analyzer |
| Is it growing, stable or under threat? | Status: expanding, consolidated, threatened, or insufficient data | 02 Trend Analyzer |
| What is local demand here, specifically? | Local estimate with demographic, tourism and distribution corrections and an uncertainty interval | 03 Geo Market |
| How do consumers feel about it online? | Consumer Sentiment Index (CSI), 0 to 100, with purchase levers and barriers | 04 Consumer Feeling |
| Who is already there and at what price? | Competitors, public prices, assortments, channels | 05 Competition Scout |
| Should I go, and how? | Market Opportunity Score (MOS) and an entry brief | 06 Opportunity Advisor |

**Five product rules. These override every other choice.**

1. **Every number carries a grade.** A is measured data. B is a model estimate. C is an exploratory signal. The grade is stored with the value and shown beside it everywhere, including exports.
2. **Missing data is never a low score.** A cell without enough evidence is shown as insufficient data, visually distinct, and is excluded from rankings instead of sinking to the bottom.
3. **The model never does arithmetic.** All indices, trends and estimates are computed by versioned SQL and TypeScript functions. Language models classify text, extract themes and write prose around numbers they are handed.
4. **Every claim is traceable.** Each figure links to its source, date, method version and ingestion run. A brief sentence without a citation does not ship.
5. **Keep distinctions the proposal makes.** Nominal value is separate from volume. Value produced in a territory is separate from demand consumed in it. Online sentiment is never presented as a representative sample.

**Out of scope for the pilot.** Paid retail panel licences, e-commerce or transactions, a native mobile app, scraping that breaks a platform's terms, and any individual-level consumer profiling.

## 3. Fixed decisions

One web application, one database, one repository. No native app, no separate backend server.

| Area | Decision | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) with TypeScript in strict mode | Server rendering for fast first load on phones, one codebase for web and mobile |
| Styling | Tailwind CSS with shadcn/ui components, design tokens as CSS variables | Full control of the look, accessible primitives, dark and light themes from one token set |
| Mobile | Responsive, mobile first, installable as a PWA | Meets the proposal's responsive requirement without an app store |
| Backend | Supabase: Postgres, Auth, Row Level Security, Storage, Edge Functions | Already connected. Covers auth, roles, audit and backups required by the proposal |
| Extensions | PostGIS for territories, pgvector for semantic search over mentions and sources, pg\_cron for schedules | Geography, retrieval and scheduling stay inside the database |
| Heavy pipelines | Node scripts in `/pipelines`, run by scheduled GitHub Actions | Ingestion can run for minutes. Edge Functions are kept for short on-demand calls |
| Runtime AI | Anthropic API from server code only. Sonnet for orchestration, briefs and chat. Haiku for bulk classification of mentions | Quality where reasoning matters, low cost where volume matters |
| Maps | MapLibre GL with open vector tiles | No per-load licence cost, works with PostGIS output |
| Charts | Recharts, wrapped in project chart components | Simple, themeable, enough for time series, bars and intervals |
| Exports | PDF by server-side rendering of a print route. Word by the `docx` library | Both required by the proposal, both carry sources and grades |
| Language | Italian by default, English available. All strings through `next-intl` | Italian users, European reach |
| Hosting | Vercel, deploying from GitHub. Preview deployment per pull request | Zero-configuration fit for Next.js. Connected and confirmed |
| Testing | Vitest for scoring and pipeline logic, Playwright for flows at 390 px and 1440 px, pgTAP for RLS | The scoring functions and access rules are where a silent bug costs most |

**Repository layout.**

```
/app            Next.js routes (it and en locales)
/components     ui (primitives), charts, map, cell, shell
/lib            scoring, queries, ai (tools, prompts), i18n, export
/pipelines      one folder per connector, shared normaliser
/supabase       migrations, seed, functions, tests
/docs           SPEC.md, DECISIONS.md, METHODS.md, SOURCES.md
/.claude        agents, commands
```

**Conventions.**

- Every schema change is a migration file. No manual edits in the Supabase dashboard.
- Model identifiers, weights and thresholds live in configuration or database rows, never as literals in components.
- Secrets only in Vercel, GitHub and Supabase secret stores. The Anthropic key and the Supabase service key never reach the browser.
- `main` is protected. Work lands through pull requests with green checks.

## 4. Architecture

The system is a pipeline that turns sources into graded observations, observations into scores, and scores into briefs. The interface and the chat only read what the pipeline has stored.

**Data flow.**

1. **Ingest.** A connector fetches one source, stores the raw file in Supabase Storage with a hash, and records a row in `source_runs`.
2. **Normalise.** The shared normaliser maps the raw data to `observations`: category, territory, indicator, period, value, optional low and high bounds, grade, source, run, method version.
3. **Compute.** Deterministic functions read observations and write snapshots: trend status, geo estimate, CSI, MOS. Each snapshot stores its inputs and method version, so it can be reproduced.
4. **Narrate.** The advisor agent receives a cell's snapshots and observation ids and writes the brief. Each sentence with a figure must reference observation ids that exist.
5. **Serve.** Pages read from views. Nothing is computed in the browser except weight what-if simulations on already loaded components.

**The six modules as runtime agents.** An orchestrator routes a request to module agents. Each agent is a server function with a fixed prompt, a small set of typed tools and a JSON output schema.

| Agent | Deterministic part | Language model part |
| --- | --- | --- |
| 01 Data Scout | Connectors, normaliser, deduplication, run log | Mapping messy source labels to the category and territory taxonomy, flagged for review below a confidence threshold |
| 02 Trend Analyzer | Growth rates, deflation of nominal series, status classification | One-paragraph reading of the series |
| 03 Geo Market | Local demand model and uncertainty interval | Explaining which correction moved the estimate |
| 04 Consumer Feeling | Sampling, language detection, aggregation into CSI | Scoring each mention on five dimensions, extracting levers and barriers |
| 05 Competition Scout | Price and assortment tables, channel counts | Matching product listings to categories |
| 06 Opportunity Advisor | MOS and ranking | Entry brief, positioning advice |
| Orchestrator (chat) | Tool execution, citation check | Understanding the question, choosing tools, composing the answer |

**Conversational search.** The chat never writes SQL. It calls typed tools such as `get_cell`, `rank_opportunities`, `compare_territories`, `get_levers`, `get_sources`. Each tool returns values with observation ids. A post-check rejects any answer whose numbers are not present in the tool results, then retries once, then answers that the data is not available.

**Auth and roles.** Supabase Auth with email magic link. Sign-up is open: anyone can register, with email confirmation and a captcha. A new user gets a personal organisation and the Member role. Analyst and Admin are assigned by an admin only, and during the pilot they are the R&S project team. Because sign-up is open and the Anthropic account is the project owner's, runtime AI is capped: 20 chat turns and 3 brief generations per user per day, plus a global daily spend limit with a kill switch in the admin screen. All caps are configuration values.

| Role | Can do |
| --- | --- |
| Admin | Everything, including sources, weights, users, audit log, publishing briefs |
| Analyst | Run pipelines, review taxonomy mappings and briefs, edit weight sets |
| Member | Read all cells, use chat, save watchlists, create product passports, export |
| Viewer | Read published sheets and briefs only |

Roles are stored in `memberships`, not in user-editable metadata. Role changes are admin only and written to the audit log.

**Compliance.** No personal data about consumers is stored. Mentions are kept as short excerpts with author identifiers removed at ingestion. Users can export and delete their account data. Every write to weights, sources, roles and briefs lands in an append-only `audit_log`. Supabase daily backups are on. All data and code are portable: schema in migrations, methods in `docs/METHODS.md`, a full export command in `/pipelines`.

## 5. Data model, methods and access rules

One fact table, `observations`, holds every number. Everything else either describes it or is derived from it.

**Tables.**

| Group | Tables | Notes |
| --- | --- | --- |
| Identity | `organizations`, `profiles`, `memberships` | Role lives on `memberships` |
| Taxonomy | `categories`, `territories`, `indicators` | Territories carry level (city, region, country), NUTS code where one exists, PostGIS geometry, population |
| Provenance | `sources`, `source_runs`, `raw_files`, `method_versions` | A source has licence, URL, cadence, default grade. A run has status, row counts, errors |
| Facts | `observations` | category, territory, indicator, period, value, low, high, unit, grade (A, B, C), source, run, method version, `is_demo` |
| Derived | `trend_snapshots`, `geo_estimates`, `csi_snapshots`, `mos_snapshots`, `cells` | `cells` is one row per category and territory with the latest status, scores and coverage |
| Sentiment | `mentions`, `mention_scores`, `levers`, `barriers` | Excerpt, language, date, source, embedding. No author identifiers |
| Competition | `competitors`, `offers` | Public price, pack size, channel, URL, observed date |
| Advice | `briefs`, `brief_versions`, `brief_citations` | Status: draft, reviewed, published |
| User space | `weight_sets`, `product_passports`, `watchlists`, `alerts`, `conversations`, `messages`, `exports`, `feedback` | Scoped to the organisation |
| Control | `audit_log`, `acceptance_targets` | Append only. Targets feed the acceptance dashboard |

**Methods.** All live in `/lib/scoring`, are pure functions with unit tests, and are documented in `docs/METHODS.md`. Thresholds below are starting values, stored in `method_versions` and calibrated on the pilot cases.

*Trend status (module 02).* Deflate nominal value with the relevant price index. Compute the compound annual growth rate of real value and of volume over the latest three to five years.

- Expanding: real value growth of at least +2% a year and volume not falling.
- Threatened: real value or volume falling by 2% a year or more.
- Consolidated: everything in between.
- Insufficient data: fewer than three annual points, or only grade C inputs.

*Local demand (module 03).* National per capita spend on the category, times resident population, times three correction factors: regional consumption index, tourist presence, density of relevant points of sale. Each factor has a low and high value. The estimate is stored with the resulting interval and is always grade B.

*Consumer Sentiment Index (module 04).* Each mention is scored 0 to 100 on five dimensions. The index is their weighted mean across mentions in the period.

```latex
CSI = 0.30\,G + 0.25\,D + 0.20\,F + 0.15\,V + 0.10\,P
```

G is liking, D desirability, F trust, V perceived value, P stated purchase intent. The snapshot stores the number of mentions, period, languages, sources and a representativeness note. Below 50 mentions the index is not published for that cell. CSI is always grade C.

*Market Opportunity Score (module 06).* Each component is a percentile rank from 0 to 100 among cells that have it.

```latex
MOS = 0.30\,Growth + 0.20\,Size + 0.20\,CSI + 0.15\,(100 - Pressure) + 0.15\,Fit
```

Size is accessible local demand. Pressure combines competitive density and barriers. Fit is the match between the product's attributes and the levers that matter in that territory. MOS is computed only when Growth and Size exist. If other components are missing, weights are renormalised over those present and the score is labelled partial with its coverage percentage. Weights are editable per organisation through `weight_sets`.

**Access rules (RLS on every table, no exceptions).**

- Taxonomy, sources, observations, derived tables and published briefs: readable by any signed-in user. Writable only by the service role used by pipelines.
- User space tables: readable and writable only by members of the owning organisation.
- Draft and reviewed briefs: analysts and admins only.
- `audit_log`: insert by trigger only, read by admins, no update or delete for anyone.
- `memberships.role`: column-level grant so a user cannot raise their own role.

Each rule has a pgTAP test that signs in as each role and asserts what it can and cannot do.

## 6. Screens and acceptance criteria

Ten screens cover the six modules. The cell sheet is the centre of the product. Every other screen is a way to reach a cell or act on one.

| Screen | Route | What it does | Done when |
| --- | --- | --- | --- |
| Scout (home) | `/` | Pick a category and a territory, get the verdict: status, MOS, one sentence, grade mix | A new user reaches a verdict in two interactions on a phone |
| Matrix | `/matrix` | 15 by 20 grid coloured by status or MOS. Insufficient data cells are hatched, not pale | All 300 cells render, filter and sort in under one second after load |
| Map | `/map` | Territories as points or areas for one category, sized by local demand, coloured by status | Tapping a territory opens its cell as a sheet |
| Cell sheet | `/cell/[category]/[territory]` | Tabs: Market, Territory, Consumers, Competition, Opportunity, Sources | Every figure shows grade, date and source on tap. Nominal and volume shown separately |
| Opportunities | `/opportunities` | Ranked cells by MOS with component bars. Weight sliders re-rank live | Changing a weight re-ranks without a server call. Partial scores are labelled |
| Ask | `/ask` | Conversational search in Italian or English with cited answers | Ten reference questions return correct figures with working citations |
| Briefs | `/briefs` | Entry briefs per cell, version history, export to PDF and Word | Export contains sources, dates and grades. No uncited figure |
| Product passport | `/passport` | A firm describes its product. The app computes Fit per territory | Saving a passport changes Fit and MOS for that organisation only |
| Watchlist | `/watchlist` | Saved cells and in-app alerts when a status changes. Built after the Sunday release | A status change on a saved cell creates an alert |
| Admin | `/admin` | Sources and runs, taxonomy review queue, weights, users, audit log, acceptance dashboard | An analyst can rerun a connector and approve a mapping without touching the database |

**Cell sheet tabs in detail.**

- **Market.** Value, volume, price index, trend chart with real and nominal lines, status with the rule that produced it.
- **Territory.** Local demand estimate with interval bar, the three correction factors, production in the territory shown apart from consumption.
- **Consumers.** CSI dial with its five components, number of mentions, period, languages, representativeness note, ranked levers and barriers with example excerpts.
- **Competition.** Competitor list, price ladder per pack size, channel mix, assortment gaps.
- **Opportunity.** MOS with component breakdown, the entry brief, a button to generate or refresh the brief.
- **Sources.** Every observation behind the sheet, with grade, source, date, run and method version. This tab is the evidence ledger.

**Source connectors.** The proposal requires at least eight integrated sources. Build these candidates in this order. Sources 1 to 5, 8 and 9 are built for the Sunday release. Sources 6, 7 and 10 follow after it. Before writing each connector, verify its licence and access terms and record them in `docs/SOURCES.md`. A source whose terms do not allow the use is dropped and replaced, not worked around.

| # | Source | Feeds | Grade |
| --- | --- | --- | --- |
| 1 | Eurostat (trade, production, price indices, population) | Market, trend, deflators | A |
| 2 | ISTAT (household spending, prices, population, tourism) | Market, local demand corrections | A |
| 3 | EU geographical indications register (eAmbrosia) | Category taxonomy, origin attributes | A |
| 4 | Open Food Facts | Assortment, product attributes, competitors | A for attributes, C for coverage |
| 5 | OpenStreetMap | Density of points of sale per territory | B |
| 6 | ISMEA market prices | Price series for Italian categories | A |
| 7 | UN Comtrade | Trade flows beyond the EU | A |
| 8 | Wikimedia pageviews | Interest signal by language | C |
| 9 | GDELT news index | Media attention and themes | C |
| 10 | Review and discussion platforms through their official APIs | Mentions for CSI, levers, barriers | C |

**Definition of done for any screen.** Works at 390 px and 1440 px. Keyboard reachable. Italian and English strings. Loading, empty, error and insufficient data states designed, not defaulted. Playwright flow green. No figure without a grade.

## 7. UI and UX direction

Design the phone screen first, as one calm dark surface with a single answer in the centre and the controls in a tray under the thumb. The desktop layout is the same parts given more room, not a different product.

**What the reference does well.** The video shows a mobile card game. Ignore the subject. Keep these qualities:

- Near-black background with almost no chrome. One idea per screen.
- A large, light-weight headline that states the current state in plain words.
- A rounded tray rising from the bottom that holds the main control.
- A horizontal carousel of round coloured tokens, the centre one enlarged and selected.
- A two-column grid of icon tiles as the menu, and bottom sheets for everything secondary.
- List cards with a title, one line of meta and a small illustration at the right.
- Thin progress bars and small counters instead of dense widgets.
- Soft, physical motion: things slide, settle and scale. Nothing flashes.

**How each quality translates.**

| In the reference | In FASTO FTS |
| --- | --- |
| Token carousel in the tray | Category selector. Each of the 15 categories is a round token with its own colour and icon. A second row selects the territory |
| Big centred statement | The verdict: "In espansione", with MOS beneath it and a one-line reason |
| Two cards side by side | The pairing of product and territory that defines the cell |
| Hatched face-down card | The insufficient data state. A hatched pattern means unknown, everywhere in the app |
| Tile grid menu | The six modules as tiles, opening as tabs of the cell sheet |
| Location list with meta line | Opportunity ranking: territory, status, MOS, coverage |
| Bottom sheet | Sources, method notes, filters, weight sliders |
| Thin progress bar | Evidence coverage of a cell and the A, B, C grade mix |

**Do not carry over.** Credits, wheels, streaks, rewards, shops or any gambling-style mechanic. This is a tool for public bodies and firms. Playfulness lives in motion and clarity only.

**Brand and tokens.** The logo is a navy and yellow roundel with the letters FT. Starting values below. Sample the exact brand colours from the logo file on Day 1 and replace them.

| Token | Dark theme (default) | Light theme | Use |
| --- | --- | --- | --- |
| `bg` | `#0A0C10` | `#F6F7F9` | Page |
| `surface` | `#14171D` | `#FFFFFF` | Tray, cards, sheets |
| `surface-2` | `#1D2129` | `#ECEEF2` | Tiles, inputs |
| `text` | `#F2F4F7` | `#0E1116` | Primary text |
| `text-muted` | `#8A93A3` | `#5B6472` | Meta, labels |
| `brand` | `#FFD400` | `#0B3D91` | Primary action, selection |
| `brand-alt` | `#2F6BDB` | `#FFD400` | Links, secondary accent |
| `expanding` | `#34C77B` | `#16864C` | Status |
| `consolidated` | `#4C9BE8` | `#1F64B5` | Status |
| `threatened` | `#F0803C` | `#C2530F` | Status |
| `unknown` | hatched `#2A2F39` | hatched `#D5D9E0` | Insufficient data |

Status is never shown by colour alone. Each status also has a word and an icon. Grades are small letter badges: A solid, B outlined, C dotted outline.

**Type and shape.** One sans family with a wide weight range, for example Inter or Geist. Verdict at 40 to 56 px in weight 300. Body 15 to 16 px. Numbers in tabular figures. Radii: 28 px for the tray and sheets, 20 px for cards, full round for tokens. Touch targets at least 44 px.

**Layout by breakpoint.**

| Width | Navigation | Cell sheet | Selector |
| --- | --- | --- | --- |
| Under 640 px | Bottom bar with four items: Scout, Matrix, Ask, More | Full screen, tabs swipe sideways | Token carousel in bottom tray |
| 640 to 1024 px | Bottom bar or left rail | Two-column tabs | Tray docked at bottom |
| Over 1024 px | Left rail with labels | Verdict column on the left, evidence panels on the right | Token rows in a left panel, command palette on Ctrl K |

On phones the matrix becomes a list of categories that expands into a horizontal strip of territory dots. A 15 by 20 grid is never shrunk to fit.

**Motion.** 200 to 300 ms spring transitions for tray, sheets and token selection. Verdict text cross-fades when the cell changes. Respect `prefers-reduced-motion`.

**Accessibility and performance.** WCAG AA contrast in both themes. Full keyboard path. Charts have a text summary and a data table view. Target a Lighthouse mobile performance score of 90 or more on the Scout screen. The PWA caches the shell and the last viewed cells for offline reading.

## 8. Agent orchestration for the build

Opus 5.5 decides and reviews. Sonnet builds. Haiku searches, seeds and tidies. The lead never delegates a decision, and never does bulk work a sub agent can do.

**Who does what.**

| Agent | Model | Owns | Never does |
| --- | --- | --- | --- |
| Lead | Opus 5.5 | Planning each day, schema and migrations, RLS, scoring methods, runtime agent prompts and tool contracts, pull request review, merges, `DECISIONS.md` | Repetitive edits, seed files, string tables |
| `ui-builder` | Sonnet | One screen or component set per task, with its states and Playwright flow | Schema changes, new dependencies without approval |
| `connector-builder` | Sonnet | One source connector per task: fetch, normalise, tests, entry in `SOURCES.md` | Changing the `observations` contract |
| `test-writer` | Sonnet | Vitest for scoring, pgTAP for RLS, Playwright for flows | Editing the code under test to make a test pass |
| `reviewer` | Sonnet | Independent review of a pull request against this spec and the five product rules, with no access to the author's reasoning | Approving its own work |
| `scout` | Haiku | Read-only codebase and documentation search, summarising API docs | Writing code |
| `seeder` | Haiku | Taxonomy seeds, Italian and English strings, fixtures, icon mapping, changelog | Inventing market figures |

Define each sub agent as a file in `.claude/agents/` with its model, tool allowance and the relevant part of this table as its prompt.

**Working loop for every task.**

1. The lead writes a task card: goal, files in scope, contract to respect, acceptance check, what not to touch.
2. A sub agent works on a branch named `day-N/short-name`, in its own worktree when tasks run in parallel.
3. The sub agent returns a summary, the diff and test output. No summary without test output.
4. `reviewer` checks the pull request. The lead reads the review and the diff, then merges or sends it back.
5. The lead updates `docs/PROGRESS.md` with what shipped and what is next.

**Parallelism.** Run up to five sub agents at once, only on tasks with no shared files. Screens and connectors parallelise well. Schema work is always serial and always done by the lead first.

**Guard rails.**

- Migrations go to a Supabase development branch or a separate development project first. Production receives only merged migrations.
- No destructive SQL without a backup step in the same task card.
- Continuous integration runs type check, lint, Vitest, pgTAP and Playwright on every pull request. Red means no merge.
- Cost control for runtime AI: cache mention scores by content hash, batch Haiku calls, cap tokens per chat turn, log spend per module in a `usage` table.
- Prompts for runtime agents live in `/lib/ai/prompts` as versioned files with evaluation fixtures. A prompt change needs its fixtures to pass.

## 9. Innovative additions

Eight ideas go beyond the proposal. Five are in the build because they strengthen the proposal's own promises. Three are parked for after the release.

| Idea | What it is | Why it matters | When |
| --- | --- | --- | --- |
| Evidence ledger | The Sources tab: every observation behind a sheet with grade, date, run and method | Turns "verifiable" from a claim into a feature. Answers the risk of unreliable generated content | Day 3 |
| Data gap map | A matrix view that shows coverage instead of scores: which cells lack which inputs | Makes missing data visible and gives the funder a concrete list of sources to acquire | Day 3 |
| What-if weights | Sliders on the ranking that re-rank instantly, with saved weight sets per organisation | The proposal asks for configurable weights. This makes them understandable | Day 4 |
| Product passport | A firm enters price band, certifications, format, story, capacity. Fit and MOS become specific to that product | Moves from "is this market good" to "is this market good for me" | Day 4 |
| Acceptance dashboard | Live counters against the seven acceptance targets: 15 categories, 20 territories, 30 sheets, 8 sources, 10 sentiment controls, 15 firms and 20 trained users, 10 reports | The funder sees progress towards sign-off at any moment | Day 5 |
| Territory twins | For a territory where a product already sells, find the most similar territories by demand profile and levers | A natural expansion path for a small firm | After release |
| Signal digest | Weekly email per organisation: status changes, new levers, price moves on watched cells | Brings users back without them opening the app | After release |
| Public showcase cell | One read-only cell sheet with no login, for presentations and fundraising | Lets R&S and FASTO show the product to a funder in one link | After release |

A human review loop is built in from Day 3: pilot users rate each brief and each CSI reading as right, partly right or wrong. Ratings are stored in `feedback` and are the evidence for the proposal's ten sentiment control cases.

## 10. Roadmap

The build runs in five days, Wednesday 11 to Sunday 15 November 2026, and ends with a production release on Sunday. The date is fixed, so scope gives way: every screen and all six modules ship, on a reduced depth of data.

&#91;embedded content: build roadmap · 5 days, each closed by a gate\]

Each diamond is a gate checked at the end of that day. If a gate is missed, apply the cut order below the same evening and start the next day on time.

**Day 1, Wednesday 11. Foundations.**

- GitHub repository, branch protection, continuous integration, Vercel project, Supabase project with a development branch.
- Full schema of section 5 with RLS and pgTAP tests. Open sign-up with email confirmation, personal organisation, roles, usage caps.
- Design tokens with brand colours sampled from the logo, both themes, app shell, Italian and English.
- Seed 15 categories and 20 territories with geometry and population.
- Licence check for sources 1 to 5, 8 and 9, recorded in `docs/SOURCES.md`.
- Gate: a new user signs up on a phone on the deployed URL and lands on the Scout screen.

**Day 2, Thursday 12. Data spine.** Modules 01, 02, 03.

- Shared normaliser, run log, raw file storage.
- Connectors in parallel: Eurostat, ISTAT, geographical indications register, Open Food Facts, OpenStreetMap.
- Trend status and local demand functions with unit tests and `METHODS.md` entries.
- Matrix screen, admin screens for sources and runs.
- Gate: the matrix shows real graded observations, and an analyst can rerun a connector from the admin screen.

**Day 3, Friday 13. Cells and consumers.** Modules 04, 05.

- Scout screen with token carousel. Cell sheet with all six tabs. Map. Data gap view.
- Connectors for Wikimedia pageviews and GDELT. Mention pipeline with Haiku scoring, levers and barriers. CSI snapshots.
- Competitor and offer tables from Open Food Facts.
- Feedback controls for human review.
- Gate: all 300 cells show a status or an explicit insufficient data state, and every figure opens its source.

**Day 4, Saturday 14. Advisor.** Module 06 and the orchestrator.

- MOS with partial score handling, weight sets, what-if sliders, Opportunities screen.
- Brief generation with citation check and review workflow. PDF and Word export.
- Ask screen with typed tools and ten reference questions as an evaluation set.
- Product passport.
- Gate: three briefs exported with no uncited figure, and the ten reference questions pass.

**Day 5, Sunday 15. Release.**

- Audit log screens, account deletion, privacy notice, usage and spend panel with kill switch.
- Acceptance dashboard. PWA install. Performance and accessibility pass at 390 px and 1440 px.
- Full Playwright run on the production build. Code freeze at 18:00. Merge to `main`, production deployment, smoke test on a real phone.
- A short `docs/HANDOVER.md`: what shipped, what was cut, known gaps, next steps.
- Gate: the production URL is live, sign-up works, and five reviewed cell sheets with briefs are published.

**What Sunday delivers against the proposal's acceptance targets.** The proposal's targets belong to the 12 month funded project. The release is its working base.

| Target | Sunday release | Proposal target |
| --- | --- | --- |
| Categories configured | 15 | 15 |
| Territories configured | 20 | 20 |
| Cells with a status or explicit insufficient data | 300 | 300 |
| Fully documented, reviewed cell sheets | 5 | 30 |
| Sources integrated | 5 or more, up to 7 | 8 |
| Sentiment control cases reviewed by a person | 3 | 10 |
| Demonstration reports exported | 3 | 10 |
| Firms and trained users | Starts after release | 15 firms, 20 users |

**Cut order if a day gate slips.** Cut from the top. Log each cut in `docs/HANDOVER.md`.

1. PWA offline caching. Keep install.
2. Product passport.
3. Word export. Keep PDF.
4. Map. Keep matrix and data gap view.
5. Light theme. Keep dark.
6. GDELT connector. Keep Wikimedia as the single sentiment signal.
7. English strings. Keep Italian.

**Never cut.** RLS and its tests, grades on every figure, the citation check, the insufficient data state, usage caps, and the mobile layout of Scout and the cell sheet.

**After the release.** Sources 6, 7 and 10. Watchlist and alerts. Scaling reviewed sheets from 5 to 30. User manual in Italian. The three parked ideas of section 9. Validation with firms.

**Mapping to the proposal's work packages.**

| Work package | Covered by |
| --- | --- |
| WP1 Requirements and methodology | This document, Day 1, `METHODS.md` |
| WP2 Sources and database | Days 1 and 2, then sources 6, 7 and 10 after release |
| WP3 Agents and economic analysis | Days 2 and 4 |
| WP4 Consumer Feeling | Day 3, extended after release |
| WP5 Dashboard and interface | Days 1 to 5 |
| WP6 Experimentation and validation | Starts after release, runs on the live platform |
| WP7 Coordination and transfer | Acceptance dashboard, `HANDOVER.md`, `DECISIONS.md` |

## 11. Risks and confirmed decisions

The largest risk is thin local data, not software. The build handles it by design: grades, intervals, the insufficient data state and the data gap map.

| Risk | Response built into the product |
| --- | --- |
| Territorial data incomplete for many cells | Insufficient data state, coverage percentage, data gap map, partial MOS labelling |
| Online sentiment is biased and unrepresentative | CSI always grade C, minimum of 50 mentions, sample details shown, human control cases |
| Generated text states something false | Model never computes, citation check on every brief and chat answer, review before publishing |
| A platform restricts or forbids access | Official APIs only, licence check before each connector, sources are replaceable modules |
| Paid data becomes necessary | Connector contract accepts licensed sources later without schema change |
| Low adoption by non-analyst users | Verdict-first mobile interface, onboarding tested with pilot users in the week after release |
| Runtime AI cost drifts | Caching by content hash, Haiku for volume, token caps, spend logged per module |
| Lock-in | Open stack, schema in migrations, methods documented, full export command |

**Decisions confirmed by the project owner on 10 November 2026.** Nothing is open. Build on these.

| Topic | Decision |
| --- | --- |
| Product name | FASTO FTS, in the interface, repository and domain |
| Deadline | Production release on Sunday 15 November 2026 |
| Three added categories | Coffee, chocolate, vinegar and condiments. Chosen for clear trade and price codes and strong quality and origin segments |
| Territories | 12 Italian cities and 8 European cities, chosen on Day 1 by data availability |
| Hosting | Vercel, already connected, European region. Supabase in a European region |
| Anthropic API | The project owner's account, with credits loaded. Key stored as a server secret, usage capped as in section 4 |
| Analysts | The R&S project team |
| Sign-up | Open to anyone |
