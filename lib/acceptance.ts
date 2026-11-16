/**
 * Pure helpers behind the acceptance dashboard (SPEC sections 6 and 10). No I/O: the page reads
 * `public.acceptance_progress()` through the signed-in user's client.
 */

/** Sunday release (SPEC section 10), as a UTC calendar day. */
export const RELEASE_DATE = "2026-11-15";

/** One row of `acceptance_progress()`. The generated types mark every column non-null; three can be null. */
export type AcceptanceRow = {
  slug: string;
  label_it: string;
  label_en: string;
  release_target: number;
  project_target: number;
  current_value: number | null;
  measured: boolean;
  manual_note: string | null;
  updated_at: string | null;
  sort_order: number;
};

/** Slugs with a "how it is measured" line in the messages. Others still render, without that line. */
export const ACCEPTANCE_SLUGS = ["categories", "territories", "cells", "reviewed_sheets", "sources", "sentiment_controls", "reports", "firms", "trained_users"] as const;
export type AcceptanceSlug = (typeof ACCEPTANCE_SLUGS)[number];
export const isAcceptanceSlug = (s: string): s is AcceptanceSlug => (ACCEPTANCE_SLUGS as readonly string[]).includes(s);

/**
 * State against the release target.
 * `afterRelease`: the release asks nothing of this target (release target 0), so it is neither met nor missed.
 * `notRecorded`: a hand-recorded target nobody has filled in yet. Missing is not zero.
 */
export type AcceptanceState = "met" | "inProgress" | "notStarted" | "afterRelease" | "notRecorded";

export function acceptanceState(row: Pick<AcceptanceRow, "release_target" | "current_value">): AcceptanceState {
  if (!(row.release_target > 0)) return "afterRelease";
  if (row.current_value === null) return "notRecorded";
  if (row.current_value >= row.release_target) return "met";
  return row.current_value > 0 ? "inProgress" : "notStarted";
}

/** True when the 12-month target is reached. Never true without a value or without a target. */
export function projectMet(row: Pick<AcceptanceRow, "project_target" | "current_value">): boolean {
  return row.current_value !== null && row.project_target > 0 && row.current_value >= row.project_target;
}

/**
 * Bar geometry, as shares of the track (0..1). The track spans the larger of the two targets, so the
 * release target sits inside it as a marker and the project target is its end.
 * `release` is null when the release asks nothing or coincides with the end of the track.
 */
export function barGeometry(row: Pick<AcceptanceRow, "release_target" | "project_target" | "current_value">): { fill: number; release: number | null } {
  const scale = Math.max(row.project_target, row.release_target);
  if (!(scale > 0)) return { fill: 0, release: null };
  const fill = Math.min(Math.max((row.current_value ?? 0) / scale, 0), 1);
  const release = row.release_target > 0 && row.release_target < scale ? row.release_target / scale : null;
  return { fill, release };
}

/** Header summary: only targets the release actually asks for are counted as met or not. */
export function summariseAcceptance(rows: Pick<AcceptanceRow, "release_target" | "current_value">[]): { due: number; met: number; afterRelease: number } {
  let due = 0;
  let met = 0;
  let afterRelease = 0;
  for (const r of rows) {
    const s = acceptanceState(r);
    if (s === "afterRelease") afterRelease += 1;
    else {
      due += 1;
      if (s === "met") met += 1;
    }
  }
  return { due, met, afterRelease };
}

export const MANUAL_VALUE_MAX = 100_000;
export const MANUAL_NOTE_MAX = 500; // same as the column check

export type ManualField = "value" | "note";

/**
 * Parses the editor's raw strings. A blank value means "not recorded" (null), never zero.
 * Whole numbers only, 0..MANUAL_VALUE_MAX. The note is trimmed; blank becomes null.
 */
export function validateManual(input: { value?: unknown; note?: unknown }): { ok: true; value: number | null; note: string | null } | { ok: false; errors: Partial<Record<ManualField, true>> } {
  const errors: Partial<Record<ManualField, true>> = {};
  const rawValue = typeof input?.value === "number" ? String(input.value) : typeof input?.value === "string" ? input.value.trim() : "";
  let value: number | null = null;
  if (rawValue !== "") {
    if (!/^\d{1,7}$/.test(rawValue) || Number(rawValue) > MANUAL_VALUE_MAX) errors.value = true;
    else value = Number(rawValue);
  }
  if (input?.note != null && typeof input.note !== "string") errors.note = true;
  const note = typeof input?.note === "string" ? input.note.trim() : "";
  if (note.length > MANUAL_NOTE_MAX) errors.note = true;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value, note: note === "" ? null : note };
}
