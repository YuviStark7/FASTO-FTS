# Sources

Licence and access terms are verified before a connector is written. A source whose terms do not allow the use is dropped and replaced, never worked around. Every claim below was read on the official page on **10 November 2026** (URL given), unless marked *pending*.

| # | Source | Licence | Attribution | Access | Default grade | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Eurostat statistics | CC BY 4.0 (EC reuse policy, Decision 2011/833/EU). Commercial and non-commercial reuse allowed | "Source: Eurostat" plus dataset code; state any modification; non-responsibility disclaimer | Dissemination API, JSON-stat, no key | A | **OK with conditions** |
| 1b | Eurostat GISCO boundaries | Specific GISCO terms: **no commercial use**; "© EuroGeographics for the administrative boundaries" on any map | Copyright line in map legend and introduction | Download | — | **Not used in the pilot** (see DECISIONS) |
| 2 | ISTAT | CC BY 4.0, "per qualsiasi fine, anche commerciale" | Credit ISTAT, link the licence, say if changed | SDMX web service (esploradati) | A | **OK with conditions** |
| 3 | eAmbrosia (EU GI register) | European Commission reuse notice (same EC policy as Eurostat) | "Source: European Commission, eAmbrosia" | Only an HTML register is published as the official distribution. The web app reads an undocumented internal API | A | **Licence OK, access pending**: no documented machine interface |
| 4 | Open Food Facts | Database: ODbL 1.0. Contents: DbCL 1.0. Images: CC BY-SA | "Open Food Facts contributors", link to product; ODbL notice | API and dumps, no key | A attributes / C coverage | **OK with conditions**: ODbL share-alike on derived database; no images |
| 5 | OpenStreetMap | ODbL 1.0 | "© OpenStreetMap contributors" and link to openstreetmap.org/copyright | Overpass API / extracts | B | **OK with conditions**: ODbL share-alike on derived database |
| 8 | Wikimedia pageviews | CC0 1.0 | None required; credited as good practice | Analytics API; **User-Agent with contact required**; one request at a time | C | **OK with conditions** |
| 9 | GDELT | Terms of Use, https://www.gdeltproject.org/about.html#termsofuse (read 11 Nov 2026): "all datasets released by the GDELT Project are available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee." "You may redistribute, rehost, republish, and mirror any of the GDELT datasets in any form." | "any use or redistribution of the data must include a citation to the GDELT Project and a link to this website (https://www.gdeltproject.org/)." Shown beside every GDELT figure and in exports | DOC 2.0 API, no key. Rate limit: "limit requests to one every 5 seconds" (HTTP 429 otherwise); sequential requests with spacing | C | **OK with conditions**: citation and link required; derived monthly counts may be stored and shown. Media attention only, not demand |

## Pages read

- Eurostat: https://ec.europa.eu/eurostat/help/copyright-notice — "Reuse of statistical data, metadata, publications … for commercial or non-commercial purposes is authorised provided the source is acknowledged." Modifications "must be stated clearly to the end user". Data "belonging to sources other than Eurostat" may not be reused commercially.
- GISCO: https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units — permission granted on condition that "the data will not be used for commercial purposes" and the notice "© EuroGeographics for the administrative boundaries" is shown.
- ISTAT: https://www.istat.it/note-legali/ — "Salvo diversa indicazione, tutti i contenuti … sono soggetti alla licenza Creative Commons – Attribuzione – versione 4.0", reuse "per qualsiasi fine, anche commerciale".
- eAmbrosia: data.europa.eu dataset `eambrosia-eu-geographical-indications-register` — one HTML distribution under "European Commission reuse notice".
- Open Food Facts: https://world.openfoodfacts.org/terms-of-use — database under ODbL, contents under DbCL, images under CC BY-SA; terms of use also apply to re-users.
- OpenStreetMap: https://www.openstreetmap.org/copyright — ODbL; credit OpenStreetMap and make clear the data is under ODbL; "If you alter or build upon our data, you may distribute the result only under the same licence."
- Wikimedia: https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html — CC0 1.0; User-Agent required, format `<client>/<version> (<contact>)`; wait for each request to finish before the next. Verified 11 Nov 2026 for the connector: endpoint `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/user/{article}/monthly/{YYYYMMDD}/{YYYYMMDD}` (agent=user; unknown article returns 404; months with no data are omitted, never zero); article titles come from Wikidata sitelinks (`https://www.wikidata.org/w/api.php?action=wbgetentities`, CC0), also rate-limited (HTTP 429 with retry). Views are by language edition, not by country: Belgium has no rows and Austria shares German with Germany.

## Rules every connector follows

1. Store the source, dataset code and retrieval date with every observation (`source_id`, `source_ref`, `run_id`).
2. Show the attribution line of each source in the Sources tab, in the footer of every export, and on the `/sources` page.
3. Mark modified or derived figures as such (grade B, method version) — Eurostat and ISTAT both require stating changes.
4. Send `User-Agent: FASTO-FTS/<version> (https://fasto-fts.vercel.app)` on every request.
5. OFF and OSM derived tables (`offers` attributes, point-of-sale density) are a derivative database under ODbL: they stay available under ODbL through the full export command.
