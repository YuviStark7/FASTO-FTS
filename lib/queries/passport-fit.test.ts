import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({}) }));

import { toPassport } from "./passport-fit";
import { LEVER_LABELS } from "@/lib/ai/levers";

describe("toPassport", () => {
  it("keeps only known claims and price bands", () => {
    expect(toPassport({ price_band: "premium", certifications: ["DOP"], attributes: { claims: ["gift_occasion", "x"] } })).toEqual({
      priceBand: "premium",
      certifications: ["DOP"],
      claims: ["gift_occasion"],
    });
    expect(toPassport({ price_band: "cheap", certifications: [], attributes: null }).priceBand).toBeNull();
  });
  it("can map every stored lever label back to its code", () => {
    const labels = Object.values(LEVER_LABELS).map((l) => l.en);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
