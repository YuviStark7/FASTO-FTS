/**
 * Pure helpers behind the admin operations screens (usage and spend, audit log, users).
 * No I/O here: pages and server actions read through the signed-in user's client and RLS.
 */

export const USAGE_KINDS = ["chat_turn", "brief", "classification", "pipeline"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export const ROLES = ["admin", "analyst", "member", "viewer"] as const;
export type AppRole = (typeof ROLES)[number];

/** Tables with an audit trigger (supabase/migrations). Used for the filter list only. */
export const AUDITED_TABLES = ["acceptance_targets", "app_config", "brief_versions", "briefs", "memberships", "sources", "weight_sets"] as const;
export const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const AUDIT_PAGE_SIZE = 50;

// ---------------------------------------------------------------- caps

/** Editable caps: form field, `app_config` key, accepted range. Ranges are checked on the server. */
export const CAP_FIELDS = [
  { field: "chatTurns", key: "ai.daily_chat_turns_per_user", min: 0, max: 200, integer: true },
  { field: "briefs", key: "ai.daily_briefs_per_user", min: 0, max: 20, integer: true },
  { field: "globalSpend", key: "ai.global_daily_spend_usd", min: 0, max: 500, integer: false },
  { field: "classification", key: "ai.daily_classification_budget_usd", min: 0, max: 100, integer: false },
  { field: "maxTokens", key: "ai.max_tokens_per_chat_turn", min: 256, max: 8000, integer: true },
] as const;
export type CapField = (typeof CAP_FIELDS)[number]["field"];
export type CapValues = Record<CapField, number>;
export type CapError = "required" | "range" | "integer";

/** Parses raw form strings. Either every field is valid, or the errors say which are not. */
export function validateCaps(
  input: Partial<Record<CapField, unknown>>,
): { ok: true; values: CapValues } | { ok: false; errors: Partial<Record<CapField, CapError>> } {
  const values = {} as CapValues;
  const errors: Partial<Record<CapField, CapError>> = {};
  for (const { field, min, max, integer } of CAP_FIELDS) {
    const raw = input[field];
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim().replace(",", ".") : "";
    if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) {
      errors[field] = "required";
      continue;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || n < min || n > max) errors[field] = "range";
    else if (integer && !Number.isInteger(n)) errors[field] = "integer";
    else values[field] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

/** A numeric `app_config` value, or null when the row is missing or not a number. */
export function configNumber(config: Record<string, unknown>, key: string): number | null {
  const v = config[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------- usage

export type UsageRow = {
  created_at: string;
  user_id: string | null;
  module: string;
  kind: string;
  cost_usd: number | string;
  input_tokens: number;
  output_tokens: number;
};

/** Start of the UTC day: the same boundary the quota check uses (`date_trunc('day', now())`). */
export function utcDayStart(now: Date, daysAgo = 0): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
// Costs are numeric(12,6): sum in whole micro-dollars so the totals do not drift.
const micro = (v: number | string) => Math.round(Number(v) * 1e6);

export type UsageSummary = {
  today: {
    cost: number;
    calls: number;
    classificationCost: number;
    byModuleKind: { module: string; kind: string; calls: number; inputTokens: number; outputTokens: number; cost: number }[];
    byUser: { userId: string; chatTurns: number; briefs: number; cost: number }[];
  };
  days: { day: string; cost: number; calls: number; byKind: Record<UsageKind, number> }[];
};

/** Totals for today, and one line per day for the last `days` days (oldest first, empty days included). */
export function summariseUsage(rows: UsageRow[], now: Date, days = 14): UsageSummary {
  const todayKey = now.toISOString().slice(0, 10);
  const emptyKinds = (): Record<UsageKind, number> => ({ chat_turn: 0, brief: 0, classification: 0, pipeline: 0 });
  const perDay = new Map<string, { cost: number; calls: number; byKind: Record<UsageKind, number> }>();
  for (let i = days - 1; i >= 0; i--) perDay.set(utcDayStart(now, i).toISOString().slice(0, 10), { cost: 0, calls: 0, byKind: emptyKinds() });

  const mk = new Map<string, UsageSummary["today"]["byModuleKind"][number]>();
  const users = new Map<string, UsageSummary["today"]["byUser"][number]>();
  let cost = 0;
  let calls = 0;
  let classificationCost = 0;

  for (const r of rows) {
    const c = micro(r.cost_usd);
    const key = dayKey(r.created_at);
    const d = perDay.get(key);
    if (d) {
      d.cost += c;
      d.calls += 1;
      if ((USAGE_KINDS as readonly string[]).includes(r.kind)) d.byKind[r.kind as UsageKind] += c;
    }
    if (key !== todayKey) continue;
    cost += c;
    calls += 1;
    if (r.kind === "classification") classificationCost += c;
    const id = `${r.module}\u0000${r.kind}`;
    const m = mk.get(id) ?? { module: r.module, kind: r.kind, calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    m.calls += 1;
    m.inputTokens += r.input_tokens;
    m.outputTokens += r.output_tokens;
    m.cost += c;
    mk.set(id, m);
    if (r.user_id) {
      const u = users.get(r.user_id) ?? { userId: r.user_id, chatTurns: 0, briefs: 0, cost: 0 };
      if (r.kind === "chat_turn") u.chatTurns += 1;
      if (r.kind === "brief") u.briefs += 1;
      u.cost += c;
      users.set(r.user_id, u);
    }
  }

  const usd = (m: number) => m / 1e6;
  return {
    today: {
      cost: usd(cost),
      calls,
      classificationCost: usd(classificationCost),
      byModuleKind: [...mk.values()].map((m) => ({ ...m, cost: usd(m.cost) })).sort((a, b) => b.cost - a.cost || a.module.localeCompare(b.module)),
      byUser: [...users.values()]
        .map((u) => ({ ...u, cost: usd(u.cost) }))
        .sort((a, b) => b.chatTurns + b.briefs - (a.chatTurns + a.briefs) || b.cost - a.cost),
    },
    days: [...perDay.entries()].map(([day, d]) => ({
      day,
      calls: d.calls,
      cost: usd(d.cost),
      byKind: Object.fromEntries(USAGE_KINDS.map((k) => [k, usd(d.byKind[k])])) as Record<UsageKind, number>,
    })),
  };
}

/** Share of a limit already used, clamped to 0..1. Null when there is no positive limit to compare with. */
export function shareOf(value: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(1, Math.max(0, value / limit));
}

// ---------------------------------------------------------------- audit

export type AuditChange = { key: string; before: string | null; after: string | null };

const MAX_VALUE_LENGTH = 240;
function show(v: unknown): string | null {
  if (v === undefined) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > MAX_VALUE_LENGTH ? `${s.slice(0, MAX_VALUE_LENGTH)}…` : s;
}

/** Only the keys whose value differs between the two row images. A missing side (insert, delete) is null. */
export function diffRows(oldRow: unknown, newRow: unknown): AuditChange[] {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const a = isObj(oldRow) ? oldRow : {};
  const b = isObj(newRow) ? newRow : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ key: k, before: show(a[k]), after: show(b[k]) }));
}

/** `?page=` is 1-based; anything else falls back to the first page. */
export function parsePage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export const shortId = (uuid: string) => uuid.slice(0, 8);

// ---------------------------------------------------------------- roles

/** The trigger's message when the only admin would lose the role (migration 20261115090000). */
export function isLastAdminError(message: string | null | undefined): boolean {
  return !!message && message.includes("last admin");
}
