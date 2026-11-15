import { CircleAlert } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CapsForm } from "@/components/admin/caps-form";
import { KillSwitch } from "@/components/admin/kill-switch";
import { NotAllowed } from "@/components/admin/not-allowed";
import { getStaffRole } from "@/lib/admin";
import { CAP_FIELDS, USAGE_KINDS, configNumber, shareOf, shortId, summariseUsage, utcDayStart, type CapField, type UsageRow } from "@/lib/admin-ops";

const DAYS = 14;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request
const MAX_PAGES = 30;
const TOP_USERS = 10;

function Meter({ label, valueText, share, limitText, overText }: { label: string; valueText: string; share: number | null; limitText: string; overText: string }) {
  const pct = share === null ? 0 : Math.round(share * 100);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="t-figure num">{valueText}</span>
        <span className="num text-sm text-muted">{limitText}</span>
      </div>
      {share !== null && (
        <>
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${valueText} · ${limitText}`}
            className="h-2.5 overflow-hidden rounded-full bg-surface-3"
          >
            <div className={`h-full rounded-full ${share >= 1 ? "bg-threatened" : "bg-brand"}`} style={{ width: `${Math.max(pct, share > 0 ? 2 : 0)}%` }} />
          </div>
          <p className="num text-sm text-muted">{pct}%</p>
          {share >= 1 && (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-threatened">
              <CircleAlert aria-hidden className="size-4" />
              {overText}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default async function AdminUsage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }, { saved }] = await Promise.all([getTranslations("admin.usage"), getFormatter(), getStaffRole(), searchParams]);
  if (role !== "admin") return <NotAllowed adminOnly />;

  const now = new Date();
  const since = utcDayStart(now, DAYS - 1).toISOString();
  const [config, users] = await Promise.all([supabase.from("app_config").select("key, value").like("key", "ai.%"), supabase.rpc("admin_users")]);
  if (config.error) throw config.error;
  if (users.error) throw users.error;

  // No aggregate endpoint: read the window page by page and sum in lib/admin-ops.
  const rows: UsageRow[] = [];
  let truncated = false;
  for (let p = 0; ; p++) {
    if (p === MAX_PAGES) {
      truncated = true;
      break;
    }
    const { data, error } = await supabase
      .from("usage")
      .select("created_at, user_id, module, kind, cost_usd, input_tokens, output_tokens")
      .gte("created_at", since)
      .order("id", { ascending: false })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
  }

  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.key, c.value as unknown]));
  const caps = Object.fromEntries(CAP_FIELDS.map((c) => [c.field, configNumber(cfg, c.key)])) as Record<CapField, number | null>;
  const enabled = typeof cfg["ai.enabled"] === "boolean" ? (cfg["ai.enabled"] as boolean) : null;
  const model = (key: string) => (typeof cfg[key] === "string" ? (cfg[key] as string) : null);
  const emails = new Map((users.data ?? []).map((u) => [u.user_id, u.email]));

  const s = summariseUsage(rows, now, DAYS);
  const usd = (v: number) => format.number(v, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const limitText = (limit: number | null) => (limit === null ? t("noLimit") : t("ofLimit", { limit: usd(limit) }));
  const cap = (n: number, limit: number | null) => (limit === null ? format.number(n) : t("ofCap", { n: format.number(n), cap: format.number(limit) }));
  const maxDay = Math.max(...s.days.map((d) => d.cost), 0);
  const anyUsage = s.days.some((d) => d.calls > 0);
  const kind = (k: string) => ((USAGE_KINDS as readonly string[]).includes(k) ? t(`kinds.${k as (typeof USAGE_KINDS)[number]}`) : k);
  const day = (d: string) => format.dateTime(new Date(`${d}T00:00:00Z`), { day: "2-digit", month: "short", timeZone: "UTC" });

  return (
    <>
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      <KillSwitch enabled={enabled} />

      <p className="rounded-[var(--radius-tile)] border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed" data-testid="estimate-note">
        {t("estimateNote")}
      </p>
      {truncated && (
        <p role="alert" className="hatched rounded-[var(--radius-tile)] border border-border-strong/60 px-4 py-3 text-sm font-medium">
          {t("truncated", { n: format.number(MAX_PAGES * PAGE) })}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="spend-today" data-testid="spend-today">
          <h2 id="spend-today" className="t-h2">
            {t("todayTitle")}
          </h2>
          <Meter
            label={t("todayTitle")}
            valueText={usd(s.today.cost)}
            share={shareOf(s.today.cost, caps.globalSpend)}
            limitText={limitText(caps.globalSpend)}
            overText={t("limitReached")}
          />
          <p className="num text-sm text-muted">{t("calls", { n: s.today.calls })}</p>
        </section>
        <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="spend-classification" data-testid="spend-classification">
          <h2 id="spend-classification" className="t-h2">
            {t("classificationTitle")}
          </h2>
          <Meter
            label={t("classificationTitle")}
            valueText={usd(s.today.classificationCost)}
            share={shareOf(s.today.classificationCost, caps.classification)}
            limitText={limitText(caps.classification)}
            overText={t("limitReached")}
          />
          <p className="text-sm text-muted">{t("classificationHint")}</p>
        </section>
      </div>

      <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="by-module">
        <h2 id="by-module" className="t-h2">
          {t("byModuleTitle")}
        </h2>
        {s.today.byModuleKind.length === 0 ? (
          <p className="text-sm text-muted">{t("todayEmpty")}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="table" data-testid="by-module">
              <thead>
                <tr>
                  <th scope="col">{t("col.module")}</th>
                  <th scope="col">{t("col.kind")}</th>
                  <th scope="col" className="!text-right">{t("col.calls")}</th>
                  <th scope="col" className="!text-right">{t("col.inputTokens")}</th>
                  <th scope="col" className="!text-right">{t("col.outputTokens")}</th>
                  <th scope="col" className="!text-right">{t("col.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {s.today.byModuleKind.map((m) => (
                  <tr key={`${m.module}/${m.kind}`}>
                    <th scope="row" className="min-w-40 break-all">{m.module}</th>
                    <td className="whitespace-nowrap">{kind(m.kind)}</td>
                    <td className="num text-right">{format.number(m.calls)}</td>
                    <td className="num text-right">{format.number(m.inputTokens)}</td>
                    <td className="num text-right">{format.number(m.outputTokens)}</td>
                    <td className="num whitespace-nowrap text-right">{usd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="top-users">
        <h2 id="top-users" className="t-h2">
          {t("topUsersTitle")}
        </h2>
        {s.today.byUser.length === 0 ? (
          <p className="text-sm text-muted">{t("topUsersEmpty")}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="table" data-testid="top-users">
              <thead>
                <tr>
                  <th scope="col">{t("col.user")}</th>
                  <th scope="col" className="!text-right">{t("col.chatTurns")}</th>
                  <th scope="col" className="!text-right">{t("col.briefs")}</th>
                  <th scope="col" className="!text-right">{t("col.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {s.today.byUser.slice(0, TOP_USERS).map((u) => (
                  <tr key={u.userId}>
                    <th scope="row" className="min-w-40 break-all">{emails.get(u.userId) ?? <span className="num">{shortId(u.userId)}</span>}</th>
                    <td className="num whitespace-nowrap text-right">{cap(u.chatTurns, caps.chatTurns)}</td>
                    <td className="num whitespace-nowrap text-right">{cap(u.briefs, caps.briefs)}</td>
                    <td className="num whitespace-nowrap text-right">{usd(u.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="by-day">
        <div className="space-y-1">
          <h2 id="by-day" className="t-h2">
            {t("byDayTitle", { days: DAYS })}
          </h2>
          <p className="text-sm text-muted">{t("utcNote")}</p>
        </div>
        {!anyUsage ? (
          <div className="hatched space-y-1 rounded-[var(--radius-tile)] border border-border-strong/60 p-4">
            <p className="font-medium">{t("emptyTitle", { days: DAYS })}</p>
            <p className="text-sm">{t("emptyBody")}</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="table" data-testid="by-day">
              <thead>
                <tr>
                  <th scope="col">{t("col.day")}</th>
                  {USAGE_KINDS.map((k) => (
                    <th key={k} scope="col" className="!text-right">{t(`kinds.${k}`)}</th>
                  ))}
                  <th scope="col" className="!text-right">{t("col.total")}</th>
                  <th scope="col" className="!text-right">{t("col.calls")}</th>
                </tr>
              </thead>
              <tbody>
                {[...s.days].reverse().map((d) => (
                  <tr key={d.day} data-day={d.day}>
                    <th scope="row" className="num whitespace-nowrap">{day(d.day)}</th>
                    {USAGE_KINDS.map((k) => (
                      <td key={k} className="num whitespace-nowrap text-right">{d.calls === 0 ? "–" : usd(d.byKind[k])}</td>
                    ))}
                    <td className="num min-w-28 whitespace-nowrap text-right">
                      {d.calls === 0 ? "–" : usd(d.cost)}
                      <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: maxDay > 0 ? `${(d.cost / maxDay) * 100}%` : 0 }} />
                      </span>
                    </td>
                    <td className="num text-right">{format.number(d.calls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-5 p-4 sm:p-6" aria-labelledby="caps">
        <div className="space-y-1">
          <h2 id="caps" className="t-h2">
            {t("caps.title")}
          </h2>
          <p className="text-sm text-muted">{t("caps.lead")}</p>
        </div>
        <CapsForm values={caps} saved={saved === "1"} />
        <dl className="grid gap-x-6 gap-y-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
          {(["ai.model.orchestrator", "ai.model.classifier"] as const).map((key) => (
            <div key={key}>
              <dt className="t-label mb-0.5">{t(key === "ai.model.orchestrator" ? "models.orchestrator" : "models.classifier")}</dt>
              <dd className="num break-all" data-testid={key}>{model(key) ?? t("notConfigured")}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">{t("models.readOnly")}</p>
      </section>
    </>
  );
}
