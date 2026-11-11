/**
 * Pilot cities whose population unit is the ISTAT comune (territories.stat_codes.population_unit).
 * `code` is the 6-digit ISTAT comune code (CL_ITTER107); `label` is the label the SDMX service
 * returns for that code and is checked on every response. `flow` is the regional dataflow
 * (same structure DCIS_POPRES1, one flow per region) that holds the comune.
 */
export type Comune = { slug: string; code: string; label: string; flow: string; region: string };

export const COMUNI: Comune[] = [
  { slug: "roma", code: "058091", label: "Roma", flow: "22_289_DF_DCIS_POPRES1_15", region: "Lazio" },
  { slug: "milano", code: "015146", label: "Milano", flow: "22_289_DF_DCIS_POPRES1_6", region: "Lombardia" },
  { slug: "napoli", code: "063049", label: "Napoli", flow: "22_289_DF_DCIS_POPRES1_18", region: "Campania" },
  { slug: "torino", code: "001272", label: "Torino", flow: "22_289_DF_DCIS_POPRES1_3B", region: "Piemonte" },
  { slug: "palermo", code: "082053", label: "Palermo", flow: "22_289_DF_DCIS_POPRES1_22", region: "Sicilia" },
  { slug: "genova", code: "010025", label: "Genova", flow: "22_289_DF_DCIS_POPRES1_5", region: "Liguria" },
  { slug: "bologna", code: "037006", label: "Bologna", flow: "22_289_DF_DCIS_POPRES1_11", region: "Emilia Romagna" },
  { slug: "firenze", code: "048017", label: "Firenze", flow: "22_289_DF_DCIS_POPRES1_12", region: "Toscana" },
  { slug: "bari", code: "072006", label: "Bari", flow: "22_289_DF_DCIS_POPRES1_19", region: "Puglia" },
  { slug: "venezia", code: "027042", label: "Venezia", flow: "22_289_DF_DCIS_POPRES1_9", region: "Veneto" },
  { slug: "verona", code: "023091", label: "Verona", flow: "22_289_DF_DCIS_POPRES1_9", region: "Veneto" },
  { slug: "cagliari", code: "092009", label: "Cagliari", flow: "22_289_DF_DCIS_POPRES1_23", region: "Sardegna" },
];

export const BASE = "https://esploradati.istat.it/SDMXWS/rest";
/** FREQ.REF_AREA.DATA_TYPE.SEX.AGE.MARITAL_STATUS: annual, population on 1 January, both sexes, all ages, all statuses. */
export const keyFor = (code: string) => `A.${code}.JAN.9.TOTAL.99`;
