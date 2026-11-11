-- Day 3: mentions and offers written by connectors; Bluesky as the pre-release discussion source.

-- Bluesky (SPEC source 10, "discussion platforms through their official APIs"). Inactive until its
-- terms are recorded in docs/SOURCES.md. Consumer mentions are exploratory signals: grade C.
insert into public.sources (slug, name, url, default_grade, cadence)
values ('bluesky', 'Bluesky (public posts, official API)', 'https://bsky.app', 'C', 'weekly');

-- One competitor per name per source; one current offer per product per territory per source.
alter table public.competitors add constraint competitors_source_name_key unique (source_id, name);
alter table public.offers add constraint offers_source_product_key
  unique nulls not distinct (source_id, external_id, territory_id);

-- A module can have several methods (module 04: mention scoring and the CSI). The method id stays the key.
alter table public.method_versions drop constraint method_versions_module_version_key;

-- Mention scoring (module 04): the classifier's prompt and model are versioned here.
insert into public.method_versions (id, module, version, description, params) values
  ('mention-score-v1', '04', 1,
   'Haiku scores each mention 0-100 on liking, desirability, trust, perceived value and purchase intent, and extracts levers and barriers. Cached by content hash.',
   '{"model_config_key": "ai.model.classifier", "batch_size": 20, "prompt": "lib/ai/prompts/mention-score.v1.md"}');

update public.method_versions set params = params || '{"window_days": 365, "min_mentions": 50}'::jsonb where id = 'csi-v1';

insert into public.app_config (key, value, description) values
  ('ai.daily_classification_budget_usd', '3'::jsonb, 'Spend cap for mention scoring per day, inside the global limit');
