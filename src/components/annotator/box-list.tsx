"use client";

import { ChevronDown, X } from "lucide-react";
import type { ClassDef, DraftBox } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FALLBACK_COLOR } from "./class-color";

interface Props {
  boxes: DraftBox[];
  classes: ClassDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** When set, each row gets a class dropdown (desktop panel). */
  onChangeClass?: (id: string, classId: string) => void;
}

const ring = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

export function BoxList({ boxes, classes, selectedId, onSelect, onDelete, onChangeClass }: Props) {
  if (!boxes.length) return <p className="py-4 text-sm text-muted-foreground">No boxes yet. Drag on the image to draw one.</p>;
  return (
    <ul className="grid gap-1.5 py-2" aria-label="Boxes">
      {boxes.map((b, i) => {
        const c = classes.find((x) => x.id === b.classId);
        const name = c?.name ?? "unknown";
        const color = c?.color ?? FALLBACK_COLOR;
        const selected = b.id === selectedId;
        return (
          <li key={b.id} className="flex gap-1.5">
            <div
              className={cn(
                "flex min-h-12 min-w-0 flex-1 items-center overflow-hidden rounded-xl border transition-[background-color,border-color] duration-150 ease-out-strong",
                selected ? "border-primary bg-accent" : "border-border hover:bg-accent",
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Box ${i + 1}, ${name}`}
                onClick={() => onSelect(b.id)}
                className={cn(
                  "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pl-3 pr-2 text-left text-sm active:scale-[0.98]",
                  ring,
                  selected && "font-semibold",
                )}
              >
                <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: color }} />
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                {!onChangeClass && <span className="min-w-0 flex-1 truncate">{name}</span>}
                {!onChangeClass && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {Math.round(b.w * 100)}&times;{Math.round(b.h * 100)}%
                  </span>
                )}
              </button>
              {onChangeClass && (
                <div className="relative mr-1 min-w-0 flex-1">
                  <select
                    aria-label={`Class for box ${i + 1}`}
                    value={b.classId}
                    onChange={(e) => onChangeClass(b.id, e.target.value)}
                    onFocus={() => onSelect(b.id)}
                    className={cn(
                      "h-10 w-full min-w-0 appearance-none truncate rounded-lg border border-input bg-background pl-2 pr-7 text-sm text-foreground",
                      ring,
                    )}
                  >
                    {!c && <option value={b.classId}>unknown</option>}
                    {classes.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={`Delete box ${i + 1}, ${name}`}
              onClick={() => onDelete(b.id)}
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out-strong hover:bg-danger/14 hover:text-danger active:scale-[0.97]",
                ring,
              )}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
