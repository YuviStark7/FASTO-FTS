import { useLocale } from "next-intl";
import { getPathname } from "@/lib/i18n/navigation";

/**
 * A plain anchor with the locale prefix: a full document navigation instead of a client transition.
 * Used between views of the same brief (another version, the print sheet). A client transition
 * that stays on the same route can intermittently fail to commit in this app, which would leave a
 * reviewer looking at the previous version; a document load cannot.
 */
export function DocumentLink({ href, children, ...rest }: Omit<React.ComponentProps<"a">, "href"> & { href: string }) {
  const locale = useLocale();
  const [path, query = ""] = href.split("?");
  return (
    <a href={`${getPathname({ href: path, locale })}${query ? `?${query}` : ""}`} {...rest}>
      {children}
    </a>
  );
}
