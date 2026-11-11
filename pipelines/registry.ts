import type { Connector } from "./shared/types";

/**
 * Connectors live in pipelines/<source slug>/index.ts and default-export a Connector.
 * The list below is the only place a source is enabled; a missing folder fails loudly at run time.
 */
export const CONNECTORS = ["eurostat", "istat", "openfoodfacts", "osm"] as const;

export const registry: Record<string, () => Promise<Connector>> = Object.fromEntries(
  CONNECTORS.map((slug) => [
    slug,
    async () => {
      const mod = (await import(/* webpackIgnore: true */ `./${slug}/index.ts`)) as { default: Connector };
      if (mod.default?.source !== slug) throw new Error(`pipelines/${slug}/index.ts must default-export a Connector with source "${slug}"`);
      return mod.default;
    },
  ]),
);
