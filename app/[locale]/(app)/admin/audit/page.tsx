import { ArrowRight, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { NotAllowed } from "@/components/admin/not-allowed";
import { DocumentLink } from "@/components/advisor/document-link";
import { getStaffRole } from "@/lib/admin";
import { AUDITED_TABLES, AUDIT_ACTIONS, AUDIT_PAGE_SIZE, diffRows, parsePage, shortId, type AuditAction } from "@/lib/admin-ops";

const ICONS: Record<AuditAction, typeof Plus> = { INSERT: Plus, UPDATE: Pencil, DELETE: Trash2 };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminAudit({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, { supabase, role }, sp] = await Promise.all([getTranslations("admin.audit"), getFormatter(), getStaffRole(), searchParams]);
  if (role !== "admin") return <NotAllowed adminOnly />;

  const page = parsePage(sp.page);
  const rawTable = one(sp.table) ?? "";
  const table = /^[a-z_]{1,63}$/.test(rawTable) ? rawTable : "";
  const rawAction = one(sp.action) ?? "";
  const action = (AUDIT_ACTIONS as readonly string[]).includes(rawAction) ? (rawAction as AuditAction) : "";

  let query = supabase
    .from("audit_log")
    .select("id, at, actor, action, table_name, row_pk, old_row, new_row", { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE - 1);
  if (table) query = query.eq("table_name", table);
  if (action) query = query.eq("action", action);
  const [log, users] = await Promise.all([query, supabase.rpc("admin_users")]);
  // PGRST103: the page starts past the last row (a stale link). Shown as an empty page, not as a failure.
  if (log.error && log.error.code !== "PGRST103") throw log.error;
  if (users.error) throw users.error;

  const rows = log.data ?? [];
  const total = log.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const emails = new Map((users.data ?? []).map((u) => [u.user_id, u.email]));
  const tables = [...new Set([...AUDITED_TABLES, ...(table ? [table] : [])])].sort();
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (table) q.set("table", table);
    if (action) q.set("action", action);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };
  const actionLabel = (a: string) => ((AUDIT_ACTIONS as readonly string[]).includes(a) ? t(`actions.${a as AuditAction}`) : a);
  const filtered = Boolean(table || action);

  return (
    <>
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      {/* A plain GET form: the filters live in the URL and the page loads as a document. */}
      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
        <div className="space-y-1.5">
          <label htmlFor="audit-table" className="t-label block">
            {t("filterTable")}
          </label>
          <select id="audit-table" name="table" defaultValue={table} className="field">
            <option value="">{t("allTables")}</option>
            {tables.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-action" className="t-label block">
            {t("filterAction")}
          </label>
          <select id="audit-action" name="action" defaultValue={action} className="field">
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            {t("apply")}
          </button>
          {filtered && (
            <DocumentLink href="/admin/audit" className="btn btn-ghost">
              {t("clear")}
            </DocumentLink>
          )}
        </div>
      </form>

      <p className="t-label num" data-testid="audit-count">
        {t("count", { count: total })}
      </p>

      {rows.length === 0 ? (
        <div className="hatched space-y-3 rounded-[var(--radius-card)] border border-border-strong/60 p-6">
          <h2 className="t-h2">{filtered || page > 1 ? t("emptyFilteredTitle") : t("emptyTitle")}</h2>
          <p>{filtered || page > 1 ? t("emptyFilteredBody") : t("emptyBody")}</p>
          {(filtered || page > 1) && (
            <DocumentLink href="/admin/audit" className="btn btn-primary">
              {t("clear")}
            </DocumentLink>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const changes = diffRows(r.old_row, r.new_row);
            const Icon = ICONS[r.action as AuditAction] ?? Pencil;
            const subject = r.table_name === "memberships" && r.row_pk ? emails.get(r.row_pk) : undefined;
            return (
              <li key={r.id} className="card space-y-3 p-4 sm:px-6 sm:py-5" data-testid="audit-row" data-table={r.table_name} data-action={r.action}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="inline-flex min-w-0 items-center gap-2 font-medium">
                    <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                    <span>{actionLabel(r.action)}</span>
                    <span className="num break-all text-muted">{r.table_name}</span>
                  </h2>
                  <time dateTime={r.at} className="num text-sm text-muted">
                    {format.dateTime(new Date(r.at), { dateStyle: "short", timeStyle: "medium" })}
                  </time>
                </div>
                <dl className="grid gap-x-6 gap-y-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="t-label mb-0.5">{t("actor")}</dt>
                    <dd className="break-all" data-testid="audit-actor">
                      {r.actor === null ? t("system") : (emails.get(r.actor) ?? <span className="num">{shortId(r.actor)}</span>)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="t-label mb-0.5">{t("rowKey")}</dt>
                    <dd className="num break-all">
                      {r.row_pk ?? "–"}
                      {subject && <span className="block font-sans text-muted">{subject}</span>}
                    </dd>
                  </div>
                </dl>
                {changes.length === 0 ? (
                  <p className="text-sm text-muted">{t("noChanges")}</p>
                ) : (
                  <details className="group text-sm">
                    <summary className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-1">
                      <ChevronRight aria-hidden className="size-4 transition-transform duration-(--dur-base) group-open:rotate-90" />
                      {t("changes", { count: changes.length })}
                    </summary>
                    <ul className="space-y-3 rounded-[var(--radius-tile)] bg-surface-2 px-4 py-3">
                      {changes.map((c) => (
                        <li key={c.key} className="space-y-1" data-testid="audit-change">
                          <p className="t-label">{c.key}</p>
                          <p className="num flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-relaxed">
                            <span className="min-w-0 break-all text-muted">
                              <span className="sr-only">{t("before")}: </span>
                              {c.before ?? t("absent")}
                            </span>
                            <ArrowRight aria-hidden className="size-3.5 shrink-0 self-center text-muted" />
                            <span className="min-w-0 break-all">
                              <span className="sr-only">{t("after")}: </span>
                              {c.after ?? t("absent")}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(pages > 1 || page > 1) && (
        <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3">
          {page > 1 ? (
            <DocumentLink href={href(page - 1)} className="btn btn-ghost" rel="prev">
              {t("newer")}
            </DocumentLink>
          ) : (
            <span />
          )}
          <span className="num text-sm text-muted" data-testid="audit-page">
            {t("pageOf", { page, pages })}
          </span>
          {page < pages ? (
            <DocumentLink href={href(page + 1)} className="btn btn-ghost" rel="next">
              {t("older")}
            </DocumentLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
