import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * WCAG AA guard for the colour tokens in app/globals.css, both themes.
 * Text pairs need 4.5:1, icons and control borders 3:1. Change a token and this says what broke.
 */
const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background]
const TEXT: [string, string][] = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"], ["text", "surface-3"],
  ["text-muted", "bg"], ["text-muted", "surface"], ["text-muted", "surface-2"], ["text-muted", "surface-3"],
  ["brand-contrast", "brand"], ["brand-alt", "bg"], ["brand-alt", "surface"], ["brand-alt", "surface-2"],
  ["expanding", "bg"], ["expanding", "surface"], ["consolidated", "bg"], ["consolidated", "surface"],
  ["threatened", "bg"], ["threatened", "surface"], ["threatened", "surface-2"],
  ["on-demo", "demo"], ["bg", "text"],
  // Text on the hatched pattern: both the base and the stripe.
  ["text", "unknown"], ["text", "unknown-stripe"],
];
const GRAPHIC: [string, string][] = [
  ["text-muted", "unknown"], ["brand", "bg"], ["brand", "surface"], ["focus", "bg"], ["focus", "surface"],
  ["chart-1", "surface"], ["chart-2", "surface"], ["chart-3", "surface"],
  ["expanding", "surface-2"], ["consolidated", "surface-2"],
];

describe.each([
  ["dark", ':root,\n[data-theme="dark"]'],
  ["light", '[data-theme="light"]'],
])("colour tokens, %s theme", (_name, selector) => {
  const t = tokens(selector);
  it.each(TEXT)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(GRAPHIC)("%s on %s reaches 3:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});
