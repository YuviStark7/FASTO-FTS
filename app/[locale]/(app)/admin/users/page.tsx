import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { NotAllowed } from "@/components/admin/not-allowed";
import { RoleSelect } from "@/components/admin/role-select";
import { DocumentLink } from "@/components/advisor/document-link";
import { getStaffRole } from "@/lib/admin";
import { ROLES } from "@/lib/admin-ops";

export default async function AdminUsers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tr, format, { supabase, role, userId: me }, sp] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations("admin.roles"),
    getFormatter(),
    getStaffRole(),
    searchParams,
  ]);
  // The rpc is admin only (it raises 42501 otherwise): analysts get the not-allowed state.
  if (role !== "admin") return <NotAllowed adminOnly />;

  const { data, error } = await supabase.rpc("admin_users");
  if (error) throw error;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 200);
  const all = data ?? [];
  const users = q ? all.filter((u) => (u.email ?? "").toLowerCase().includes(q.toLowerCase())) : all;
  const date = (v: string | null) => (v ? format.dateTime(new Date(v), { dateStyle: "medium" }) : null);

  return (
    <>
      <header className="page-header">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </header>

      <section className="card space-y-3 p-4 sm:p-6" aria-labelledby="roles-explained">
        <h2 id="roles-explained" className="t-h2">
          {t("rolesTitle")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r}>
              <dt className="font-medium">{tr(r)}</dt>
              <dd className="leading-relaxed text-muted">{t(`can.${r}`)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">{t("rolesNote")}</p>
      </section>

      {/* A plain GET form: the search lives in the URL and the page loads as a document. */}
      <form method="get" role="search" className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
          <label htmlFor="user-search" className="t-label block">
            {t("search")}
          </label>
          <input id="user-search" name="q" type="search" defaultValue={q} placeholder={t("searchPlaceholder")} autoComplete="off" className="field" />
        </div>
        <button type="submit" className="btn btn-primary">
          {t("searchButton")}
        </button>
        {q && (
          <DocumentLink href="/admin/users" className="btn btn-ghost">
            {t("clear")}
          </DocumentLink>
        )}
      </form>

      <p className="t-label num" data-testid="users-count">
        {q ? t("countFiltered", { count: users.length, total: all.length }) : t("count", { count: all.length })}
      </p>

      {users.length === 0 ? (
        <div className="hatched space-y-2 rounded-[var(--radius-card)] border border-border-strong/60 p-6">
          <h2 className="t-h2">{q ? t("emptySearchTitle") : t("emptyTitle")}</h2>
          <p>{q ? t("emptySearchBody", { q }) : t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {users.map((u) => (
            <li key={`${u.user_id}/${u.org_id}`} className="card flex flex-col gap-4 p-4 sm:p-6" data-testid="user-row">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <h2 className="t-h2 min-w-0 break-all">{u.email}</h2>
                <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm font-medium" data-testid="user-role">
                  {tr(u.role)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 text-sm">
                <div className="min-w-0">
                  <dt className="t-label mb-0.5">{t("name")}</dt>
                  <dd className="break-words">{u.display_name || t("noName")}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="t-label mb-0.5">{t("organisation")}</dt>
                  <dd className="break-words">{u.org_name || t("noName")}</dd>
                </div>
                <div>
                  <dt className="t-label mb-0.5">{t("signedUp")}</dt>
                  <dd className="num">{date(u.created_at) ?? "–"}</dd>
                </div>
                <div>
                  <dt className="t-label mb-0.5">{t("lastSignIn")}</dt>
                  <dd className="num">{date(u.last_sign_in_at) ?? t("never")}</dd>
                </div>
              </dl>
              <div className="mt-auto">
                {u.user_id === me ? (
                  <p className="text-sm text-muted" data-testid="own-row">
                    {t("ownRow")}
                  </p>
                ) : (
                  <RoleSelect userId={u.user_id} orgId={u.org_id} email={u.email} role={u.role} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
