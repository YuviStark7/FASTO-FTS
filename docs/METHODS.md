# Methods

Every index, trend and estimate is a pure function in `lib/scoring` with unit tests, versioned in `method_versions` (the parameters below are the stored starting values, to be calibrated on the pilot cases). Language models never compute any of these numbers.

## Inputs (observations written by the connectors)

| Indicator | Category | Territory | `series_key` | Source | Grade |
| --- | --- | --- | --- | --- | --- |
| `household_spend_value` | — | country | HFCE group `CP011` food, `CP012` non-alcoholic beverages | Eurostat `nama_10_co3_p3`, current prices, converted to EUR | A |
| `hicp_weight` | — | country | ECOICOP code (category classes and groups) | Eurostat `prc_hicp_inw`, per mille | A |
| `price_index` | — | country | ECOICOP code; `CP00` = all items | Eurostat `prc_hicp_aind`, annual average | A |
| `population` | — | city | unit: `istat_comune`, `nuts3` or `urban_audit` (chosen per city in `territories.stat_codes`) | ISTAT, Eurostat | A |
| `population` | — | country | — | Eurostat `demo_pjan` | A |
| `tourist_nights` | — | city | unit: `nuts3` or `urban_audit` | Eurostat `tour_occ_nin3`, `urb_ctour` | A |
| `household_income_per_capita` | — | region (NUTS 2), country | — | Eurostat `nama_10r_2hhinc` | A |
| `pos_count` | — | city | `shop=<value>` | OpenStreetMap (Overpass) | B |
| `product_count` | category | country | Open Food Facts tag | Open Food Facts | C |

Each category maps to ECOICOP classes and OSM shop types in `categories.codes`; where the class is wider or narrower than the category, `codes.scope_note` says so and the interface shows it.

## Trend status — `trend-v1` (module 02)

Scope: national. The trend of a cell is the trend of its category in its country; cities in one country share it. Local differences enter through local demand (module 03) and, from Day 4, the Opportunity Score.

For each year *y* where every input exists:

```
nominal(y)    = Σ over the category's classes c of  HFCE[group(c), y] × w[c, y] / w[group(c), y]
priceIndex(y) = Σ w[c, y] × P[c, y] / Σ w[c, y]
real(y)       = nominal(y) / P[CP00, y] × 100        (value deflated by general inflation)
volume(y)     = nominal(y) / priceIndex(y) × 100     (value deflated by the category's own prices)
```

*w* is the HICP weight (per mille), *P* the HICP annual index. Nominal value, real value and volume are kept apart (product rule 5) and stored in `trend_snapshots.series`.

Window: the latest run of consecutive years, at most `max_years` (5) years of growth. CAGR = (last / first)^(1 / years) − 1.

| Status | Rule |
| --- | --- |
| Expanding | real value CAGR ≥ `expanding_min_real_cagr` (+2%) **and** volume CAGR ≥ 0 |
| Threatened | real value CAGR ≤ `threatened_max_cagr` (−2%) **or** volume CAGR ≤ −2% |
| Consolidated | everything in between |
| Insufficient data | fewer than `min_annual_points` (3) consecutive annual points, only grade C inputs, non-positive values, or no statistical class for the category (Organic) |

Grade: the weakest input grade, and never better than B (the allocation by HICP weights is a model step). The snapshot stores the rule that fired, the window, and the ids of every observation used.

Known limits: HFCE by COICOP group is published with a lag (to 2022 at the time of writing) while HICP runs to the current year; the window ends at the last year where all inputs exist. HICP weights measure monetary household spending in the domestic concept, including non-residents; this is consistent with a demand view.

## Local demand — `geo-v1` (module 03)

Always grade B, always with an interval.

```
perCapita = nominal(Y) / national population(Y)
base      = perCapita × city population
income    = (regional income per capita / national income per capita) ^ e         e ∈ [0.3, 0.5, 0.7]
tourism   = 1 + s × tourist nights / (365 × city population)                       s ∈ [0.5, 0.75, 1.0]
outlets   = (city shop density / median density of pilot cities in the country) ^ g   g ∈ [0, 0.1, 0.2]
estimate  = base × income × tourism × outlets     (mid parameters)
interval  = base × Π min(factor) … base × Π max(factor) over the parameter ranges
```

*Y* is the last year of the national trend series. Shop density = relevant OSM shops (the category's `osm_shop` types) per 10,000 residents. A missing correction is neutral (factor 1) and listed in `factors.missing`; a missing national spend or population means no estimate. Where the statistical unit is wider than the city (`stat_codes.scope_note`), the note travels with the estimate.

What the interval covers: only the uncertainty of the three correction parameters. It does not include sampling error in the inputs or the mismatch between years (spending is from the last trend year, population and tourism from their latest year; `factors.years` records each). Read it as "how much the corrections could move the estimate", not as a confidence interval.

Production in a territory is never used as consumption (product rule 5): production indicators feed the Territory tab separately.

## Cells

`cells.status` is the trend status. `coverage_pct` is the share of the four inputs (trend, local demand, sentiment, competition) present. `grade_mix` counts the grades of the observations behind the cell. `missing_inputs` feeds the data gap map. Cells with insufficient data are excluded from rankings, never scored low.

## Mention scoring — `mention-score-v1` (module 04, language model)

The only step of module 04 that uses a language model, and it only classifies. Claude Haiku 5.5 (`app_config` `ai.model.classifier`) receives batches of 20 mentions with the prompt `lib/ai/prompts/mention-score.v1.md` and returns, for each mention, through a validated JSON schema:

- `relevant`: is the text about the product as food or drink (idioms, names, ads, spam are not);
- five scores 0-100 (liking, desirability, trust, perceived value, purchase intent; 50 = neutral or not expressed);
- levers and barriers from a fixed vocabulary (`lib/ai/mention-score.ts`).

Results that break the contract (a relevant mention without all five scores, an irrelevant one with scores) are dropped and the mention stays unscored. Scores are cached per mention, and mentions are unique by content hash, so a text is scored once. Spend is logged in `usage` (module 04, kind classification) and stopped by the kill switch, the global daily limit and `ai.daily_classification_budget_usd`. A prompt change must pass `lib/ai/prompts/mention-score.v1.fixtures.json` (`pnpm eval:mention-score`).

## Consumer Sentiment Index — `csi-v1` (module 04)

```
CSI = (0.30 G + 0.25 D + 0.20 F + 0.15 V + 0.10 P) / Σ weights
```

G, D, F, V, P are the means over the relevant mentions of the window (`window_days`, 365) of liking, desirability, trust, perceived value and purchase intent. Computed in `lib/scoring/csi.ts`, never by the model.

- Scope: category × country. Mentions are tied to their language's country, not to a city; every pilot city shares its country's CSI and the note says so.
- Not published below `min_mentions` (50): the snapshot is stored with `is_published = false` and the cell shows insufficient data, never a low score.
- Always grade C. The representativeness note states the number of posts, sources, languages and period, and that online posts are not a representative sample.
- Levers and barriers: share of relevant mentions expressing each code (once per mention), up to three example mention ids.

## Market Opportunity Score — `mos-v1` (module 06)

Code: `lib/scoring/mos.ts` (pure, unit-tested), written by `pipelines/compute/compute.ts` after the cells. One snapshot per category × pilot city per compute run, under the system default weight set.

**Components.** Each is the percentile rank (0 to 100) of a raw figure among the 300 cells that have it. Ties take the mid-rank: p = 100 × (values below + (equal values − 1) / 2) / (n − 1); a lone value gets 50.

| Component | Raw figure | Present when | Grade |
| --- | --- | --- | --- |
| Growth | Real value CAGR of the national trend snapshot (`trend-v1`) | The trend is not insufficient data | The trend's grade (B) |
| Size | Local demand estimate in EUR (`geo-v1`) | A geo estimate exists | B |
| CSI | Published CSI of the category in the country (`csi-v1`) | The CSI is published (50 mentions or more) | C |
| Pressure | Mean of two percentile ranks: distinct competitors with an offer for the category in the country (Open Food Facts), and barrier citations per relevant mention behind the published CSI | At least one of the two exists | C |
| Fit | Product passport against the territory's levers | Only for an organisation with a passport; never in system snapshots | — |

Growth, CSI and Pressure are national, so every pilot city in a country shares them. Size is the only city-level component today.

**Score.** MOS = Σ wₖ pₖ / Σ wₖ over the present components, with Pressure entering as 100 − p. The default weights are 0.30 Growth, 0.20 Size, 0.20 CSI, 0.15 Pressure and 0.15 Fit (`weight_sets`, system default).

- **No score:** without Growth or Size there is no MOS. The cell shows no number, and its missing inputs say why.
- **Partial:** when any other component is missing, the weights are renormalised over the present ones and the score is labelled partial. Coverage is the share of total weight the present components carry. System snapshots never have Fit, so today every MOS is partial, with at most 85% coverage.
- **Grade:** the weakest grade among the present components, never better than B. With CSI or Pressure present it is C.
- **Rank:** the order by MOS, highest first, with ties sharing a rank.

Each snapshot stores, per component, the raw figure, the percentile, the grade and the points it adds. It also stores the trend, geo and CSI snapshot ids it read and the weight set.

**What-if.** The Opportunities screen re-ranks with other weights in the browser, using the same `scoreMos` on the stored percentiles. This is the only arithmetic done in the browser. Saved weight sets belong to the organisation.

**Limits.** Percentiles are relative: a cell can rank high in a weak field. Competitor counts reflect Open Food Facts coverage, not the market. Barrier rates come from online posts, not a representative sample.
