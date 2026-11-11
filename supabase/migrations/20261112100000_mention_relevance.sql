-- The classifier first decides whether a mention is about the food product at all
-- ("pasta" as an idiom, "honey" as a name). Irrelevant mentions are kept, scored as such,
-- and excluded from the CSI.
alter table public.mention_scores add column relevant boolean not null default true;
alter table public.mention_scores alter column liking drop not null;
alter table public.mention_scores alter column desirability drop not null;
alter table public.mention_scores alter column trust drop not null;
alter table public.mention_scores alter column perceived_value drop not null;
alter table public.mention_scores alter column purchase_intent drop not null;
alter table public.mention_scores add constraint mention_scores_relevant_has_scores check (
  not relevant or (liking is not null and desirability is not null and trust is not null
                   and perceived_value is not null and purchase_intent is not null)
);
