# FASTO FTS: handover

Release: Sunday 15 November 2026 (SPEC section 10). This file records what shipped, what was cut or is still open, the known gaps, and what to do next. Figures are from the production database and the repository on 16 November 2026.

Production: https://fasto-fts.vercel.app (Vercel, EU). Database: Supabase project `efuvmiaztmubhntezpca` (eu-central-1). Repository: `YuviStark7/FASTO-FTS`, `main` protected, every change merged through a pull request with green checks.

## What shipped

**Data (graded, sourced, reproducible).**
- 15 categories × 20 pilot cities = 300 cells. Every cell has a status, or explicitly says it has insufficient data.
- Seven sources are integrated through official APIs. Their licences and terms are recorded in `docs/SOURCES.md`.
  - Eurostat
  - ISTAT
  - Open Food Facts
  - OpenStreetMap (all 20 cities)
  - Wikimedia pageviews
  - GDELT
  - Bluesky
- 26,593 Bluesky mentions have been collected and classified. Author identities are removed at ingestion, and no post URLs are stored.
- Methods, all versioned and documented in `docs/METHODS.md`:
  - `trend-v1`: trend status;
  - `geo-v1`: local demand with an interval;
  - `csi-v1`: the Consumer Sentiment Index, published only with at least 50 mentions; 62 of 75 category × country pairs are published;
  - `mos-v1`: the Market Opportunity Score; 279 cells have one, all partial until a passport adds Fit;
  - `fit-v1`: Fit, scored per organisation from its product passport.
- Every figure carries its grade (A measured, B model estimate, C exploratory). Any figure opens the evidence ledger: its source, run, date and method version.

**Screens (Italian default, English available, dark and light, 390 px and 1440 px).**
- Scout, with the first-visit flower intro.
- Matrix, coloured by status or by MOS.
- Map.
- Cell sheet with six tabs: Market, Territory, Consumers, Competition, Opportunity, Sources.
- Opportunities, with what-if weight sliders and organisation weight sets.
- Ask, which answers through typed tools only, with cited answers.
- Briefs, with generation, review, publishing, version history, and PDF and Word export.
- Product passport, with Fit per city and an organisation view on Opportunities.
- Settings: account export, account deletion, install the app.
- Privacy notice.

**Advisor (AI).**
- Model ids live in `app_config`: Sonnet writes briefs and answers in Ask; Haiku classifies mentions.
- The model never computes figures. It writes around facts that code builds, and cites them by id.
- A deterministic citation check rejects any number that is not in a cited fact. A stored brief always passes the check; Ask answers "data not available" instead.
- Limits:
  - 20 chat turns and 3 brief generations per user per day;
  - a global daily spend limit of $25;
  - a classification budget of $3 per day;
  - a kill switch.
  - All of these are editable in Admin → Usage.
- Total AI spend to date: about $2.96.

**Admin (staff only).**
- Sources and runs, including reruns.
- Feedback summary.
- Usage and spend, with the kill switch and the caps editor.
- Audit log.
- Users and roles. The last admin cannot be demoted or removed.
- Acceptance dashboard.
- Reference-question runner.

**Security and compliance.**
- RLS is on every table, with pgTAP tests per role: 7 test files.
- Role changes are admin-only and audited.
- The audit log is append-only.
- The Anthropic key and the Supabase secret key are server-only and live only in Vercel, GitHub and Supabase secret stores.
- No consumer personal data is stored.
- Account data export and deletion are in Settings.

**PWA.** The app can be installed. It has icons (including a maskable icon), a manifest with shortcuts, and a service worker that shows an offline page.

## Gates and acceptance targets

| Gate | State |
| --- | --- |
| Day 1: sign up on a phone, land on Scout | Met |
| Day 2: matrix with real graded observations; analyst reruns a connector from admin | Met |
| Day 3: all 300 cells have a status or explicit insufficient data; every figure opens its source | Met |
| Day 4: ten reference questions pass; three briefs exported with no uncited figure | Questions: 10/10. Briefs: three versions exported, every one passing the citation check |
| Day 5: production live, sign-up works, five reviewed cell sheets with published briefs | Live; sign-up works. **Published briefs: 1 of 5 (open)** |

Acceptance dashboard (`/admin/acceptance`), measured in production:

| Target | Now | Release target |
| --- | --- | --- |
| Categories | 15 | 15 |
| Territories | 20 | 20 |
| Cells with a status or explicit insufficient data | 300 | 300 |
| Sources integrated | 7 | 5 |
| Demonstration reports exported | 3 | 3 |
| Reviewed cell sheets with a published brief | 1 | 5 |
| Sentiment control cases reviewed by a person | 0 | 3 |
| Firms involved, trained users | recorded by hand | start after release |

To close the two open release targets:
- **Published briefs:** generate four more and publish them. Do it from a cell's Opportunity tab, then Briefs → Publish (admins). The default limit is 3 generations per user per day; an admin can raise it for a day in Admin → Usage, or a second analyst account can generate.
- **Sentiment reviews:** rate three published sentiment readings with the controls on a cell's Consumers tab.

## Release checks (16 November 2026)

- **Tests on `main`:**
  - typecheck and lint pass;
  - Vitest: 368 passed;
  - pgTAP: 7 files pass;
  - Playwright full suite on the production build at 390 and 1440 px: 129 passed, 1 skipped (a desktop-only keyboard test).
- **Accessibility:** `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A and AA) on the public pages, all member screens and all admin screens at both widths. Two serious issues were found and fixed: the Sources table scroll region was not keyboard-reachable, and the map markers had nested controls. The scan now passes.
- **Performance:** measured on the production build with 4× CPU throttling and a fast-4G-like network at 390 px.

  | Page | Load | Largest paint | JS |
  | --- | --- | --- | --- |
  | Scout | 0.8 s | 0.5 s | 157 kB |
  | Matrix | 1.0 s | 0.9 s | 155 kB |
  | Map | 0.8 s | 0.8 s | 405 kB (map library) |
  | Cell sheet | 1.0 s | 1.0 s | 269 kB |
  | Opportunities | 0.8 s | 0.8 s | 155 kB |
  | Ask | 0.7 s | 0.4 s | 150 kB |
  | Briefs | 0.7 s | 0.4 s | 146 kB |

  Layout shift was 0 on all of them. The local database had no market data, so production pages, which carry data, will be somewhat heavier.
- **Production:** the latest deployment is READY (`577826d`, PR 31). In the 48 hours before the check there were no runtime errors other than the two migration-timing incidents listed under known issues.
- **Still to do by hand:** a smoke test on a real phone. Sign up, then Scout, a cell sheet, Ask, export a brief, and install the app.

## Cut, or moved to after release

Following the SPEC cut order:
1. **PWA offline caching: cut.** Only an offline page is cached. Every figure must come fresh from the server with its grade and source.
2. **Product passport: shipped.**
3. **Word export: shipped.**
4. **Map: shipped.**
5. **Light theme: shipped.**
6. **GDELT: shipped.** Its full run has not been re-verified since the rate-limit fix (see gaps).
7. **English strings: shipped.**

Not delivered for the release, and moved to after it:
- **EU geographical indications register (eAmbrosia, source 3):** not built. The release still has seven sources against a target of five.
- **Admin taxonomy review queue:** not built. Taxonomy mappings are edited by migration.
- **Weight sets in admin:** not built. They are saved from the Opportunities screen per organisation; the system default is in the database.
- **Watchlist and alerts:** after release, per SPEC.
- **Sources 6, 7 and 10:** ISMEA, UN Comtrade and review platforms. After release, per SPEC.

## Known gaps and issues

- **Migrations after merge (twice in production):**
  - **What happened:** production only receives merged migrations, and they are applied by hand after the merge. On 14 and 15 November a screen was opened between the merge and the migration, and it errored with a column or function not found.
  - **Fix:** a GitHub Action that applies merged migrations to production on push to `main`, with the fingerprint check, then deploys, or makes Vercel wait for it.
  - **Until then:** apply the migration right after merging, before opening the screen.
- **Sentiment coverage:**
  - Vinegar and condiments has no CSI anywhere: the 20,000-post cap was reached before its searches ran.
  - Chocolate has none in Spain or the Netherlands.
  - Six pairs are under the 50-mention minimum (shown as insufficient data, never as a low score).
  - **Next:** run Bluesky with those categories first, or with a raised cap.
- **One consumer source:** Bluesky is the only consumer-opinion source; Facebook and X are not usable within the source rules (official API, terms allow the use). Online sentiment is never a representative sample, and the app says so beside every sentiment figure.
  - **Recommended next source:** YouTube comments, through the official Data API.
- **Other data checks:** the GDELT full run has not been verified since the 12 November spacing and retry fix, and ISTAT needs a rerun.
- **Client router stall (seen in tests):** under Playwright, after a server action that revalidates, the client router sometimes stays suspended. The screens work around it with a reload or plain links. Account deletion uses a plain POST route, so an irreversible step never depends on it. The root cause is not found, and it has not been confirmed in real browsers.
- **Test isolation:** the passport and opportunities specs collide when repeated in parallel (`--repeat-each 3`), because they seed the same demo category. Single runs are green. The signup spec flaked once under full-suite load and passed 42 of 42 on repeat.
- **Privacy notice:** it names no legal data controller or contact address, only "the project team" and "the platform administrator". Add the controller's details if the notice needs them.
- **Usage summary:** Admin → Usage sums up to 30,000 rows in the browser and shows a warning if it reaches that. Move it to a SQL aggregate when classification volume grows.
- **Local development:** Docker in the cloud sandbox stops on every session restart. Restart `dockerd`, then `npx supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,realtime,postgres-meta,mailpit`.

## How to operate it

- **Data runs:** GitHub Actions → Pipelines → Run workflow, with mode `all`, a source slug, `score`, `compute`, `queued` or `eval`. A weekly full refresh runs on Monday at 03:17 UTC, and queued admin reruns are swept every 30 minutes.
- **Prompt evals:** mode `eval` runs the classifier fixtures and the brief fixtures against real snapshots, for a few cents.
- **Migrations:**
  1. Write a new file in `supabase/migrations`.
  2. Run `npx supabase db reset` and `npx supabase test db` locally.
  3. Open a PR and merge it.
  4. Apply the migration to production in one transaction, with its `schema_migrations` row.
  5. Compare the catalog fingerprint with local.
  6. Run `notify pgrst, 'reload schema'`.
- **Roles:** Admin → Users and roles. New users get a personal organisation and the Member role.
- **AI limits and kill switch:** Admin → Usage.

## Next steps (in order)

1. Close the release gate: four more published briefs and three sentiment reviews.
2. Automate migrations on merge (see known issues).
3. Fill the sentiment gaps (Bluesky ordering or a higher cap), re-verify GDELT, and rerun ISTAT.
4. Add YouTube comments as a second consumer source, after recording its terms.
5. Build eAmbrosia, the taxonomy review queue and admin weight sets.
6. After release, per SPEC: watchlist and alerts; sources 6, 7 and 10; scale reviewed sheets from 5 to 30; an Italian user manual; validation with firms.
