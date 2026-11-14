"use client";
import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deletePassport, savePassport } from "@/app/[locale]/(app)/passport/actions";
import { LEVER_LABELS } from "@/lib/ai/levers";
import { getPathname } from "@/lib/i18n/navigation";
import { FIXED_CERTIFICATIONS, LIMITS, PRICE_BANDS, parsePassportInput, splitCertifications, splitStoredCertifications, type PassportField } from "@/lib/passport/input";
import type { CategoryOption, PassportDetail } from "@/lib/queries/passports";
import { LEVER_CODES, type LeverCode } from "@/lib/scoring/fit";
import { DocumentLink } from "@/components/advisor/document-link";
import { cn } from "@/lib/utils";

type FormError = PassportField | "forbidden" | "notFound" | "failed";

const CHECK =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-tile)] border border-border bg-surface px-3 py-2.5 transition-colors duration-(--dur-fast) hover:border-border-strong has-checked:border-border-strong has-checked:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--focus)]";

/**
 * Create or edit a product passport. Validation runs here for a quick answer and again in the
 * server action, which is the one that counts. After a save the browser loads the passport page
 * as a document: the Fit shown there is computed on the server from the saved row.
 */
export function PassportForm({ passport, categories }: { passport: PassportDetail | null; categories: CategoryOption[] }) {
  const t = useTranslations("passport.form");
  const tp = useTranslations("passport");
  const locale = useLocale() as "it" | "en";
  const uid = useId();
  const stored = splitStoredCertifications(passport?.certifications ?? []);

  const [name, setName] = useState(passport?.name ?? "");
  const [categoryId, setCategoryId] = useState(passport ? String(passport.category.id) : "");
  const [priceBand, setPriceBand] = useState<string>(passport?.priceBand ?? "");
  const [fixed, setFixed] = useState<string[]>(stored.fixed);
  const [other, setOther] = useState(stored.other.join(", "));
  const [claims, setClaims] = useState<LeverCode[]>(passport?.claims ?? []);
  const [format, setFormat] = useState(passport?.format ?? "");
  const [capacity, setCapacity] = useState(passport?.capacity ?? "");
  const [story, setStory] = useState(passport?.story ?? "");
  const [error, setError] = useState<FormError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const toggle = <T extends string>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const go = (href: string, query = "") => window.location.assign(`${getPathname({ href, locale })}${query}`);
  const errorId = `${uid}-error`;
  const describe = (field: PassportField) => (error === field ? { "aria-invalid": true, "aria-describedby": errorId } : {});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      categoryId: Number(categoryId),
      priceBand: priceBand || null,
      certifications: [...fixed, ...splitCertifications(other)],
      claims,
      format,
      capacity,
      story,
    };
    const parsed = parsePassportInput(input);
    if (!parsed.ok) return setError(parsed.field);
    setError(null);
    start(async () => {
      try {
        const res = await savePassport(passport?.id ?? null, input);
        if (res.ok) {
          setDone(true);
          // A document load, not a client transition: see components/advisor/document-link.tsx.
          go(`/passport/${res.id}`, "?saved=1");
        } else setError(res.error === "invalid" ? res.field : res.error);
      } catch {
        setError("failed");
      }
    });
  };

  const remove = () => {
    if (!passport) return;
    setError(null);
    start(async () => {
      try {
        const res = await deletePassport(passport.id);
        if (res.ok) {
          setDone(true);
          go("/passport", "?deleted=1");
        } else setError(res.error);
      } catch {
        setError("failed");
      }
    });
  };

  const busy = pending || done;
  const optional = <span className="ml-1.5 font-normal tracking-normal text-muted normal-case">({t("optional")})</span>;

  return (
    <form onSubmit={submit} noValidate data-testid="passport-form" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="t-label mb-1.5 block">{t("name")}</span>
          <input className="field" name="name" value={name} maxLength={LIMITS.name} required autoComplete="off" onChange={(e) => setName(e.target.value)} {...describe("name")} />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">{t("category")}</span>
          <select className="field" name="category" value={categoryId} required onChange={(e) => setCategoryId(e.target.value)} aria-describedby={error === "category" ? errorId : `${uid}-cat`} aria-invalid={error === "category" || undefined}>
            <option value="" disabled>
              {t("categoryPlaceholder")}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "en" ? c.name_en : c.name_it}
              </option>
            ))}
          </select>
          <span id={`${uid}-cat`} className="t-meta mt-1.5 block">
            {t("categoryHint")}
          </span>
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">{t("priceBand")}</span>
          <select className="field" name="priceBand" value={priceBand} onChange={(e) => setPriceBand(e.target.value)} {...describe("priceBand")}>
            <option value="">{t("priceBandNone")}</option>
            {PRICE_BANDS.map((b) => (
              <option key={b} value={b}>
                {tp(`bands.${b}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="t-label mb-2">{t("certifications")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FIXED_CERTIFICATIONS.map((c) => (
            <label key={c} className={cn(CHECK, "items-center")}>
              <input type="checkbox" className="size-4 shrink-0 accent-brand" checked={fixed.includes(c)} onChange={(e) => setFixed(toggle(fixed, c, e.target.checked))} />
              <span className="font-medium">{c}</span>
            </label>
          ))}
        </div>
        <label className="block">
          <span className="t-label mb-1.5 block">
            {t("otherCertifications")}
            {optional}
          </span>
          <input className="field" name="otherCertifications" value={other} autoComplete="off" onChange={(e) => setOther(e.target.value)} aria-describedby={error === "certifications" ? errorId : `${uid}-cert`} aria-invalid={error === "certifications" || undefined} />
          <span id={`${uid}-cert`} className="t-meta mt-1.5 block">
            {t("otherCertificationsHint")}
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="t-label mb-2">{t("claims")}</legend>
        <p className="mb-3 max-w-[75ch] text-sm leading-relaxed text-muted">{t("claimsLead")}</p>
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="passport-claims">
          {LEVER_CODES.map((code) => (
            <li key={code}>
              <label className={cn(CHECK, "h-full")}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                  checked={claims.includes(code)}
                  onChange={(e) => setClaims(toggle(claims, code, e.target.checked))}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{LEVER_LABELS[code][locale]}</span>
                  <span className="block text-[13px] leading-snug text-muted">
                    {tp(`claims.${code}`)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="t-meta mt-3 max-w-[75ch]">{t("impliedNote")}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="t-label mb-1.5 block">
            {t("format")}
            {optional}
          </span>
          <input className="field" name="format" value={format} maxLength={LIMITS.shortText} placeholder={t("formatHint")} autoComplete="off" onChange={(e) => setFormat(e.target.value)} {...describe("format")} />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">
            {t("capacity")}
            {optional}
          </span>
          <input className="field" name="capacity" value={capacity} maxLength={LIMITS.shortText} placeholder={t("capacityHint")} autoComplete="off" onChange={(e) => setCapacity(e.target.value)} {...describe("capacity")} />
        </label>
        <label className="block sm:col-span-2">
          <span className="t-label mb-1.5 block">
            {t("story")}
            {optional}
          </span>
          <textarea className="field min-h-32" name="story" value={story} maxLength={LIMITS.story} rows={5} onChange={(e) => setStory(e.target.value)} {...describe("story")} />
          <span className="t-meta num mt-1.5 block text-right">{t("storyCount", { count: story.length, max: LIMITS.story })}</span>
        </label>
      </div>

      <p id={errorId} role="alert" className={cn("note border-border-strong", !error && "sr-only")}>
        {error ? t(`error.${error}`) : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary max-sm:w-full">
          {pending && !confirming ? t("saving") : passport ? t("save") : t("create")}
        </button>
        <DocumentLink href={passport ? `/passport/${passport.id}` : "/passport"} className="btn btn-ghost max-sm:w-full">
          {t("cancel")}
        </DocumentLink>
      </div>

      {passport && (
        <div className="border-t border-border pt-5">
          {confirming ? (
            <div role="group" aria-label={t("delete")} className="space-y-3">
              <p className="text-sm leading-relaxed">{t("deleteConfirm")}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={remove} disabled={busy} className="btn btn-inverse max-sm:w-full">
                  {pending ? t("deleting") : t("deleteYes")}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn btn-ghost max-sm:w-full">
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={busy} className="btn btn-quiet max-sm:w-full">
              <Trash2 aria-hidden className="size-4" />
              {t("delete")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
