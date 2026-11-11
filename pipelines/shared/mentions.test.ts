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
