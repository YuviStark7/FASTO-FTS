import { describe, expect, it } from "vitest";
import { LEVER_CODES } from "@/lib/scoring/fit";
import { parsePassportInput, splitCertifications, splitStoredCertifications } from "./input";

const base = {
  name: " Olio del frantoio ",
  categoryId: 3,
  priceBand: "premium",
  certifications: ["dop", "Vegan OK"],
  claims: ["novelty", "quality_taste"],
  format: "",
  capacity: null,
  story: " ",
};

describe("parsePassportInput", () => {
  it("accepts a valid passport, trims text and orders certifications and claims", () => {
    expect(parsePassportInput(base)).toEqual({
      ok: true,
      value: {
        name: "Olio del frantoio",
        categoryId: 3,
        priceBand: "premium",
        certifications: ["DOP", "Vegan OK"],
        claims: ["quality_taste", "novelty"],
        format: null,
        capacity: null,
        story: null,
      },
    });
  });
  it("refuses a missing or long name", () => {
    expect(parsePassportInput({ ...base, name: "  " })).toEqual({ ok: false, field: "name" });
    expect(parsePassportInput({ ...base, name: "x".repeat(121) })).toEqual({ ok: false, field: "name" });
    expect(parsePassportInput({ ...base, name: "x".repeat(120) }).ok).toBe(true);
  });
  it("refuses a category that is not a positive integer", () => {
    for (const categoryId of ["3", 0, 1.5, null]) expect(parsePassportInput({ ...base, categoryId })).toEqual({ ok: false, field: "category" });
  });
  it("takes no price band as null and refuses an unknown one", () => {
    expect(parsePassportInput({ ...base, priceBand: "" })).toMatchObject({ ok: true, value: { priceBand: null } });
    expect(parsePassportInput({ ...base, priceBand: "cheap" })).toEqual({ ok: false, field: "priceBand" });
  });
  it("limits free-text certifications to five of twenty characters, without counting the fixed four", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(parsePassportInput({ ...base, certifications: ["DOP", "IGP", "STG", "BIO", ...five] }).ok).toBe(true);
    expect(parsePassportInput({ ...base, certifications: [...five, "f"] })).toEqual({ ok: false, field: "certifications" });
    expect(parsePassportInput({ ...base, certifications: ["x".repeat(21)] })).toEqual({ ok: false, field: "certifications" });
    expect(parsePassportInput({ ...base, certifications: ["<b>"] })).toEqual({ ok: false, field: "certifications" });
    expect(parsePassportInput({ ...base, certifications: [1] })).toEqual({ ok: false, field: "certifications" });
    expect(parsePassportInput({ ...base, certifications: ["Bio", "BIO", "Halal", "halal"] })).toMatchObject({
      ok: true,
      value: { certifications: ["BIO", "Halal"] },
    });
  });
  it("refuses a claim outside the lever vocabulary", () => {
    expect(parsePassportInput({ ...base, claims: ["novelty", "cheap"] })).toEqual({ ok: false, field: "claims" });
    expect(parsePassportInput({ ...base, claims: [...LEVER_CODES] })).toMatchObject({ ok: true, value: { claims: [...LEVER_CODES] } });
  });
  it("refuses a story over 2000 characters", () => {
    expect(parsePassportInput({ ...base, story: "x".repeat(2001) })).toEqual({ ok: false, field: "story" });
    expect(parsePassportInput({ ...base, story: "x".repeat(2000) }).ok).toBe(true);
  });
  it("refuses long format and a capacity that is not text", () => {
    expect(parsePassportInput({ ...base, format: "x".repeat(121) })).toEqual({ ok: false, field: "format" });
    expect(parsePassportInput({ ...base, capacity: 12 })).toEqual({ ok: false, field: "capacity" });
  });
});

describe("certification helpers", () => {
  it("splits the free-text field", () => {
    expect(splitCertifications(" Vegan OK, Halal;\nKosher ,")).toEqual(["Vegan OK", "Halal", "Kosher"]);
  });
  it("splits the stored list into checkboxes and free text", () => {
    expect(splitStoredCertifications(["bio", "Halal", "DOP"])).toEqual({ fixed: ["DOP", "BIO"], other: ["Halal"] });
  });
});
