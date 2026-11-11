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

## Consumer Sentiment Index — `csi-v1` (module 04)

Day 3. See SPEC section 5.

## Market Opportunity Score — `mos-v1` (module 06)

Day 4. See SPEC section 5.
