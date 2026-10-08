"use client";

import type { ClassDef } from "@/lib/types";

interface Props {
  classes: ClassDef[];
  activeId: string | null;
  onPick: (id: string) => void;
}

export function ClassPicker({ classes, activeId, onPick }: Props) {
  if (!classes.length) return <p className="py-4 text-sm">This dataset has no classes yet. Ask an admin to add some.</p>;
  return (
    <ul className="grid gap-2 py-2" role="radiogroup" aria-label="Class">
      {classes.map((c, i) => {
        const active = c.id === activeId;
        return (
          <li key={c.id}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              data-autofocus={active || (!activeId && i === 0) ? "" : undefined}
              onClick={() => onPick(c.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${
                active ? "border-foreground bg-foreground/10 font-semibold" : "border-foreground/20"
              }`}
            >
              <span className="h-5 w-5 shrink-0 rounded-full border border-foreground/30" style={{ background: c.color }} aria-hidden="true" />
              <span className="flex-1 truncate">{c.name}</span>
              {i < 9 && (
                <kbd className="hidden rounded border border-foreground/30 px-1.5 text-xs lg:inline" aria-hidden="true">
                  {i + 1}
                </kbd>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
