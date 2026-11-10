# Progress

## Day 0, Tuesday 10 November (head start)

Shipped:
- Supabase project `FASTO FTS` (eu-central-1). PR 1 merged; four migrations applied to production and verified identical to the tested schema by catalog fingerprint. Security advisor: one warning, fixed in `day-1/hardening`.
- Next.js 15 scaffold, folder layout, `CLAUDE.md`, six sub agent definitions in `.claude/agents/`, docs.
- Full section 5 schema in four migrations: identity and roles, runtime config with AI caps and kill switch, usage, append-only audit log, taxonomy, provenance, `observations`, derived snapshots, sentiment, competition, briefs with review workflow, user space, acceptance targets. RLS on every table.
- Reference data: 15 categories, 20 provisional pilot cities plus 7 countries, 17 indicators, 10 sources (all inactive until licence check), 7 method versions, default weight set, 300 cells in insufficient data state.
- pgTAP: 41 RLS assertions across anon, member, viewer, analyst, admin and a second organisation. All pass.
- Design tokens for both themes, hatched unknown state, grade badges. Shell with bottom bar and left rail. Italian and English catalogues (55 keys, parity checked).
- Magic-link sign-in with open sign-up and Turnstile captcha support. Sign-up creates profile, personal organisation and Member role.
- Scout screen: token carousel, territory chips, verdict with status word and icon, MOS, coverage bar, grade mix. Shows the honest insufficient-data state for all 300 cells.
- Playwright: sign-in and Scout flows green at 390 px and 1440 px. CI workflow: typecheck, lint, Vitest, pgTAP, type drift check, build, Playwright.

Day 1 gate: **passed** on 10 November. A new user (non-member address) signed up by magic link on https://fasto-fts.vercel.app and landed on Scout.
- Vercel project live, functions in Frankfurt. Branch protection on `main` (PR + green `checks` required).
- Supabase Auth: Site URL and redirect list set, token-hash email templates, Brevo SMTP (Gmail sender, 30 emails/hour).

Still open on the project owner:
- Turnstile site key and secret (captcha) before public launch.
- Logo file, to sample brand colours.
- A domain, to move emails off the Gmail sender.

Day 1 remainder, done:
- Licence check for sources 1-5, 8, 9 in `SOURCES.md`, read from the official pages. Eurostat, ISTAT, Wikimedia OK; OFF and OSM OK with ODbL share-alike; GISCO boundaries not used (non-commercial clause); eAmbrosia waiting for a documented interface; GDELT terms pending (host not reachable).
- Data availability: all 20 cities confirmed with 2025 population and tourism; Amsterdam code corrected to NUTS 2024 `NL32B`; per-city statistical units recorded.
- Admin role given to the project owner (audited). Cloud build environment `fasto-fts` with the source hosts allowed.

Next: Day 2, data spine. Shared normaliser and run log first (lead), then Eurostat, ISTAT, Open Food Facts and OpenStreetMap connectors in parallel, trend status and local demand functions, matrix and admin sources screens.
