import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["it", "en"],
  defaultLocale: "it",
  localePrefix: "as-needed",
  // Italian by default for everyone; English only when chosen (remembered in a cookie).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
