import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { filterLabels, mapProducts, parsePack } from "./offers";
import { buildListQuery, PRODUCT_FIELDS } from "./query";

const body = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "cheeses-italy-products.json"), "utf8"));
const offers = mapProducts(body, "cheese", "it", "2026-11-11");

describe("OFF product to offer", () => {
  it("maps all three products", () => expect(offers).toHaveLength(3));

  it("maps a full product with name fallback, first brand, pack and url", () => {
    expect(offers[0]).toMatchObject({
      category: "cheese",
      territory: "it",
      competitor: { name: "Caseificio Esempio", kind: "brand" },
      productName: "Parmigiano Reggiano DOP 24 mesi",
      externalId: "8001234500011",
      packSize: 200,
      packUnit: "g",
      channel: null,
      url: "https://world.openfoodfacts.org/product/8001234500011",
      observedOn: "2026-11-11",
      grade: "A",
    });
  });

  it("filters labels to certifications and keeps origins", () => {
    expect(offers[0].attributes).toEqual({ labels: ["en:pdo", "en:organic"], origins: ["en:italy"] });
    expect(filterLabels(["en:fair-trade", "en:igp", "en:vegetarian", "en:nutriscore", "en:no-additives"])).toEqual([
      "en:fair-trade",
      "en:igp",
      "en:vegetarian",
    ]);
  });

  it("skips the competitor when brands is empty and leaves pack null without a quantity", () => {
    expect(offers[1].competitor).toBeUndefined();
    expect(offers[1].packSize).toBeNull();
    expect(offers[1].packUnit).toBeNull();
  });

  it("accepts a numeric product_quantity", () => {
    expect(offers[2]).toMatchObject({ packSize: 1, packUnit: "l" });
  });

  it("never sets a price", () => {
    for (const o of offers) expect(o.price).toBeNull();
  });

  it("parses only g, kg, ml, l", () => {
    expect(parsePack({ product_quantity: "500", product_quantity_unit: "ML" })).toEqual({ packSize: 500, packUnit: "ml" });
    expect(parsePack({ product_quantity: "6", product_quantity_unit: "unit" })).toEqual({ packSize: null, packUnit: null });
    expect(parsePack({ product_quantity: "0", product_quantity_unit: "g" })).toEqual({ packSize: null, packUnit: null });
    expect(parsePack({ product_quantity: "abc", product_quantity_unit: "g" })).toEqual({ packSize: null, packUnit: null });
    expect(parsePack({ product_quantity: "200" })).toEqual({ packSize: null, packUnit: null });
  });

  it("skips products without a barcode or any name", () => {
    expect(mapProducts({ products: [{ code: "1" }, { product_name: "x" }] }, "cheese", "it", "2026-11-11")).toEqual([]);
    expect(mapProducts({ count: 3 }, "cheese", "it", "2026-11-11")).toEqual([]);
  });

  it("requests no image fields and sorts by popularity", () => {
    expect(PRODUCT_FIELDS).not.toMatch(/image/);
    const q = buildListQuery("categories", "en:cheeses", "en:italy");
    expect(q).toContain("page_size=50");
    expect(q).toContain("sort_by=unique_scans_n");
    expect(JSON.stringify(offers)).not.toMatch(/image/i);
  });
});
