"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { ClassDef } from "@/lib/types";

interface Props {
  classes: ClassDef[];
  activeId: string | null;
  onPick: (id: string) => void;
}

const SEARCH_THRESHOLD = 6;

export function ClassPicker({ classes, activeId, onPick }: Props) {
  const [q, setQ] = useState("");
  if (!classes.length) return <p className="py-4 text-sm text-muted-foreground">This dataset has no classes yet. Ask an admin to add some.</p>;

  const term = q.trim().toLowerCase();
  const shown = term ? classes.filter((c) => c.name.toLowerCase().includes(term)) : classes;
  const searchable = classes.length > SEARCH_THRESHOLD;

  return (
    <div className="flex flex-col gap-2 py-1">
      {searchable && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search classes"
            aria-label="Search classes"
            className="pl-9"
          />
        </div>
      )}
      <ul className="grid gap-1.5" role="radiogroup" aria-label="Class">
        {shown.map((c) => {
          const active = c.id === activeId;
          const i = classes.indexOf(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                data-autofocus={active || (!activeId && !searchable && i === 0) ? "" : undefined}
                onClick={() => onPick(c.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-base outline-none transition-[transform,background-color,border-color] duration-150 ease-out-strong focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.98]",
                  active ? "border-primary/60 bg-primary/10 font-semibold" : "border-border hover:bg-accent",
                )}
              >
                <span
                  className="size-6 shrink-0 rounded-full ring-2 ring-foreground/15 ring-offset-2 ring-offset-popover"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{c.name}</span>
                {i < 9 && (
                  <Kbd className="hidden lg:inline-flex" aria-hidden="true">
                    {i + 1}
                  </Kbd>
                )}
                {active && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {!shown.length && <p className="py-4 text-center text-sm text-muted-foreground">No class matches &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
