"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboItem = { id: string; label: string; meta?: string; search: string[] };

/** Accent- and case-insensitive form used for typeahead matching. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

type Props = {
  items: ComboItem[];
  value: string;
  /** Accessible name of the trigger and of the input. */
  label: string;
  placeholder: string;
  emptyText: string;
  onPick: (id: string) => void;
  /** Called when editing starts/ends so the parent does not collapse while the user types. */
  onEditing?: (editing: boolean) => void;
  /** Where the list opens relative to the field. */
  listSide?: "up" | "down";
  className?: string;
  triggerClassName?: string;
  /** Content of the trigger button (defaults to the item label). */
  children?: React.ReactNode;
  testId?: string;
};

/**
 * Editable tag: a button that turns into a text input with typeahead (ARIA combobox, list autocomplete).
 * Enter or click picks, Escape cancels, ArrowUp/Down move the active option.
 */
export function ScoutCombobox({ items, value, label, placeholder, emptyText, onPick, onEditing, listSide = "down", className, triggerClassName, children, testId }: Props) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const matches = useMemo(() => {
    const q = fold(query);
    if (!q) return items;
    const hit = items.filter((it) => it.search.some((s) => fold(s).includes(q)));
    // Prefix matches first, then the rest, each keeping the original order.
    const starts = (it: ComboItem) => it.search.some((s) => fold(s).startsWith(q));
    return [...hit.filter(starts), ...hit.filter((it) => !starts(it))];
  }, [items, query]);

  useEffect(() => onEditing?.(editing), [editing, onEditing]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const close = (refocus: boolean) => {
    setEditing(false);
    setQuery("");
    setActive(0);
    if (refocus) requestAnimationFrame(() => trigger.current?.focus());
  };
  const pick = (id: string) => {
    onPick(id);
    close(true);
  };

  const current = items.find((i) => i.id === value);

  if (!editing) {
    return (
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-label={`${label}: ${current?.label ?? ""}`}
        data-testid={testId}
        onClick={() => setEditing(true)}
        className={cn("min-h-11 cursor-text rounded-full px-5 text-sm font-semibold tracking-[0.1em] uppercase transition-[background-color,border-color,transform] duration-(--dur-base) active:scale-[0.97]", triggerClassName)}
      >
        {children ?? current?.label}
      </button>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={matches.length ? optId(Math.min(active, matches.length - 1)) : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onBlur={() => close(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close(true);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const m = matches[Math.min(active, matches.length - 1)];
            if (m) pick(m.id);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!matches.length) return;
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
          }
        }}
        className="h-11 w-52 animate-[fade-in_var(--dur-base)_ease-out] rounded-full border border-border-strong bg-surface px-4 text-center text-sm font-semibold tracking-[0.1em] uppercase shadow-e2 placeholder:font-normal placeholder:tracking-normal placeholder:text-muted placeholder:normal-case"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className={cn(
          "absolute left-1/2 z-50 max-h-56 w-60 -translate-x-1/2 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-1.5 text-left shadow-e3",
          listSide === "up" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
        {matches.map((m, i) => (
          <li
            key={m.id}
            id={optId(i)}
            role="option"
            aria-selected={i === Math.min(active, matches.length - 1)}
            // mousedown keeps the focus in the input so the blur handler does not close the list first.
            onMouseDown={(e) => {
              e.preventDefault();
              pick(m.id);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-tile)] px-3 text-sm transition-colors duration-(--dur-fast)", i === active && "bg-surface-2")}
          >
            <span>{m.label}</span>
            {m.meta && <span className="text-[10px] font-medium tracking-[0.14em] text-muted">{m.meta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
