"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

type Token = { id: string; label: string; color: string; icon: string };

/** Round coloured tokens; the selected one is enlarged and scrolled to the centre. Radio-group keyboard model. */
export function TokenCarousel({ label, items, value, onChange }: { label: string; items: Token[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    refs.current.get(value)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === value);
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = items[(i + delta + items.length) % items.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="mb-4">
      <p className="t-label mb-1 px-4 text-center text-text lg:px-1 lg:text-left">{selected?.label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKey}
        className="no-scrollbar flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-[calc(50%-28px)] py-3 lg:flex-wrap lg:overflow-visible lg:px-1"
      >
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              ref={(el) => {
                if (el) refs.current.set(it.id, el);
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={it.label}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(it.id)}
              className={cn(
                "grid shrink-0 snap-center place-items-center rounded-full text-on-category transition-all duration-(--dur-slow) ease-spring active:scale-95",
                active ? "size-14 shadow-e2 ring-2 ring-text ring-offset-[3px] ring-offset-bg" : "size-11 opacity-75 hover:-translate-y-0.5 hover:opacity-100",
              )}
              style={{ backgroundColor: it.color }}
            >
              <CategoryIcon name={it.icon} className={active ? "size-6" : "size-5"} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
