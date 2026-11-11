/**
 * Sources that have a connector in pipelines/<slug>/index.ts. Kept apart from the registry
 * (which loads connector code) so the web app can read the list without bundling pipelines.
 */
export const CONNECTORS = ["eurostat", "istat", "openfoodfacts", "osm", "gdelt"] as const;
export type ConnectorSlug = (typeof CONNECTORS)[number];
