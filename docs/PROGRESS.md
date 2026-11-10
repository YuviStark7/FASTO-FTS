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

Blocked on the project owner:
- Vercel connector authorisation for the `yuvi-stark` team.
- Turnstile site key and secret (Cloudflare) for the captcha.
- Logo file, to sample brand colours.

Next (Day 1 remainder): push and protect `main`, apply migrations to production through the first PR, Vercel project with EU region and env vars, Supabase Auth URLs and SMTP, licence check for sources 1-5, 8, 9 in `SOURCES.md`, data availability check to confirm the 20 cities, Day 1 gate on a real phone.
