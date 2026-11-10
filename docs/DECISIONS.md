# Decisions log

Choices made where the spec is silent, or where a fixed decision had to change. Newest last.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-10 | New Supabase project `FASTO FTS` (`efuvmiaztmubhntezpca`, eu-central-1) instead of reusing `FASTO INNOVA` | INNOVA is a separate live product with its own auth and RLS. Confirmed by project owner. |
| 2026-11-10 | New GitHub repo `YuviStark7/fasto-fts` | `FASTO-INNOVA-II` is the marketplace app. Confirmed by project owner. |
| 2026-11-10 | Next.js 15 + Tailwind v4 + pnpm | Current stable line at scaffold time. |
| 2026-11-10 | Locale routing with `next-intl`, `it` default, `/en` prefix only for English (`localePrefix: as-needed`) | Italian users keep clean URLs matching section 6 routes. |
| 2026-11-10 | Runtime config (AI caps, model ids, spend limit, kill switch) in an `app_config` table | Spec requires caps and model ids as configuration, editable from admin. |
| 2026-11-10 | Local Supabase stack (`supabase start`) is the development database, not a hosted dev branch | Hosted branching needs a paid plan. Every migration is applied from scratch and pgTAP-tested locally and in CI before reaching production. |
| 2026-11-10 | Admin and Analyst are global project-team roles: holding one in any membership grants it everywhere (`private.has_role`) | The R&S team works across all organisations. Member and Viewer stay org-scoped. |
| 2026-11-10 | Viewers read everything a member reads but cannot write user-space tables | "Read published sheets and briefs only" is about actions; sheets are built from the same observations. |
| 2026-11-10 | Watchlists, alerts, conversations, messages and feedback are private to the user within their org (restrictive policies) | A colleague should not read another person's chat. Passports, weight sets and exports are shared within the org. |
| 2026-11-10 | No anonymous (`anon`) access to any table | Public showcase cell is after release; until then every read needs sign-in. |
| 2026-11-10 | Brief publishing requires a version that passed the citation check, enforced by trigger for every role including the service role | Product rule 4: a brief with an uncited figure does not ship. |
| 2026-11-10 | Provisional 20 pilot cities: 12 Italian (Roma, Milano, Napoli, Torino, Palermo, Genova, Bologna, Firenze, Bari, Venezia, Verona, Cagliari) and 8 EU (Paris, Berlin, München, Madrid, Barcelona, Wien, Amsterdam, Bruxelles) | All are Eurostat Urban Audit cities, so population and tourism series should exist. Confirmed or swapped on Day 1 by the data availability check. |
| 2026-11-10 | Population and geometry are not columns on `territories`: population is an `observation` (graded, sourced); geometry arrives from Eurostat GISCO | Product rule 1: every number carries a grade. |
| 2026-11-10 | Italian is always the default; browser language detection is off. English is chosen via `/en` | SPEC: Italian by default. Detection sent English-browser users to `/en` unasked. |
| 2026-11-10 | Captcha: Cloudflare Turnstile, enabled when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and captcha is on in Supabase Auth | Supabase supports hCaptcha and Turnstile; Turnstile is free and has no image puzzles. |
| 2026-11-10 | Grade badge colours lightened/darkened from the starting tokens: `brand-alt` dark `#6C9CF0`, light `#8A6D00` | The SPEC values fail WCAG AA as link text on their backgrounds. Replace when brand colours are sampled from the logo. |
| 2026-11-10 | Mention embeddings `vector(1024)` | Common size for multilingual embedding models; Anthropic has no embedding API. Model choice made with the mention pipeline on Day 3. |
| 2026-11-10 | Every signed-in route is `force-dynamic` and calls `requireUser()` in addition to the middleware | Next prerendered the Scout page and re-rendered it as anonymous in the background. Defence in depth. |
| 2026-11-10 | Production migrations are applied with the Supabase MCP connector after merge; local files are named with the hosted version so `supabase migration list` agrees | No database password in the build environment for `supabase db push`. After applying, a catalog fingerprint (columns, policies, functions, triggers, grants) is compared between local and production. |
| 2026-11-10 | Unindexed foreign key notices (64, INFO) left for now; indexes added per query path when screens land | Empty tables; adding 64 indexes blind costs writes for no measured gain. Revisit on Day 5 performance pass. |
| 2026-11-10 | Vercel project `fasto-fts` in team `yuvi-stark`, functions pinned to `fra1` (Frankfurt). Production URL `https://fasto-fts.vercel.app` | SPEC: European region. Imported from the dashboard because the Vercel account had no GitHub login connection. |
| 2026-11-10 | Auth emails sent through Brevo SMTP with a verified Gmail sender, until FASTO has a domain | Supabase's built-in sender only reaches org members. No domain yet; Brevo allows a single verified sender without DNS. Move to a domain sender (e.g. Resend) when a domain exists. Gmail senders are more likely to land in spam. |
| 2026-11-10 | Brevo IP allow-listing left off | Supabase Auth sends from unpublished, changing IPs; allow-listing would block every sign-in email. |
| 2026-11-10 | Email templates (Magic Link, Confirm signup) link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` | Works when the link opens in a different browser than the one that asked for it (common on phones); the default PKCE link does not. Users land on Scout in Italian. |
| 2026-11-10 | Captcha not yet enabled | Needs a Cloudflare Turnstile key. Required before public launch (Day 5). |
