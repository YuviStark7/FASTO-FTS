import { describe, expect, it } from "vitest";
import { LEVER_CODES, fitRaw, passportLevers } from "./fit";
import { LEVERS } from "../ai/mention-score";

describe("passportLevers", () => {
  it("derives origin and certification from DOP/IGP, organic from BIO, value from an entry price band", () => {
    const l = passportLevers({ priceBand: "entry", certifications: ["dop", "BIO"], claims: ["gift_occasion"] });
    expect([...l].sort()).toEqual(["certification", "gift_occasion", "organic_natural", "origin_territory", "price_value"]);
  });
  it("ignores unknown claims", () => {
    expect(passportLevers({ priceBand: null, certifications: [], claims: ["teleport" as never] }).size).toBe(0);
  });
  it("uses exactly the classifier's lever vocabulary", () => {
    expect([...LEVER_CODES]).toEqual([...LEVERS]);
  });
});

describe("fitRaw", () => {
  const levers = [
    { code: "quality_taste" as const, share: 0.18 },
    { code: "origin_territory" as const, share: 0.06 },
    { code: "price_value" as const, share: 0.06 },
  ];
  it("is the share of lever citations the product answers", () => {
    expect(fitRaw(new Set(["origin_territory", "price_value"]), levers)).toBe(0.4);
  });
  it("is null when the territory has no lever readings, never zero", () => {
    expect(fitRaw(new Set(["origin_territory"]), [])).toBeNull();
  });
  it("is zero only when levers exist and none match", () => {
    expect(fitRaw(new Set(["novelty"]), levers)).toBe(0);
  });
});
