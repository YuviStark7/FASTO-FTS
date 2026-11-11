import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Messages are split per feature (messages/<locale>/<namespace>.json) so parallel work on
 * different screens never edits the same file. Top-level keys must not collide across files.
 */
export const MESSAGE_FILES = ["core", "matrix", "admin", "sheet", "map"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const parts = await Promise.all(
    MESSAGE_FILES.map(async (f) => (await import(`../../messages/${locale}/${f}.json`)).default as Record<string, unknown>),
  );
  return { locale, messages: Object.assign({}, ...parts) };
});
