import { describe, expect, it } from "vitest";
import { scrubExcerpt } from "./mentions";

describe("scrubExcerpt", () => {
  it("removes links, e-mails, handles and decentralised ids", () => {
    const out = scrubExcerpt(
      "Ottimo formaggio! https://x.test/a www.shop.example/b scrivi a mario.rossi@example.com, ciao @luca e anna.bsky.social did:plc:abc123xyz",
    );
    for (const leak of ["https://", "www.", "mario.rossi", "@luca", "anna.bsky.social", "did:plc"]) expect(out).not.toContain(leak);
    expect(out).toContain("Ottimo formaggio!");
  });

  it("keeps ordinary text and caps the length at 500", () => {
    expect(scrubExcerpt("  pane   caldo \n buono ")).toBe("pane caldo buono");
    expect(scrubExcerpt("a".repeat(600))).toHaveLength(500);
  });
});

describe("scrubExcerpt, characters Postgres refuses", () => {
  it("drops NUL and control characters", () => {
    expect(scrubExcerpt("pane\u0000 buono\u0007")).toBe("pane buono");
  });
  it("never leaves half an emoji at the 500-character cut", () => {
    const out = scrubExcerpt("a".repeat(499) + "🧀🧀");
    expect(out.isWellFormed()).toBe(true);
    expect(JSON.parse(JSON.stringify(out))).toBe(out);
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
