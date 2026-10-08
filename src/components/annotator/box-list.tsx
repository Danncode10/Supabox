"use client";

import { X } from "lucide-react";
import type { ClassDef, DraftBox } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FALLBACK_COLOR } from "./class-color";

interface Props {
  boxes: DraftBox[];
  classes: ClassDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BoxList({ boxes, classes, selectedId, onSelect, onDelete }: Props) {
  if (!boxes.length) return <p className="py-4 text-sm text-muted-foreground">No boxes yet. Drag on the image to draw one.</p>;
  const ring = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
  return (
    <ul className="grid gap-1.5 py-2" aria-label="Boxes">
      {boxes.map((b, i) => {
        const c = classes.find((x) => x.id === b.classId);
        const name = c?.name ?? "unknown";
        const color = c?.color ?? FALLBACK_COLOR;
        const selected = b.id === selectedId;
        return (
          <li key={b.id} className="flex gap-1.5">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(b.id)}
              className={cn(
                "relative flex min-h-12 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl border py-2 pl-4 pr-3 text-left text-sm transition-[transform,background-color,border-color] duration-150 ease-out-strong active:scale-[0.98]",
                ring,
                selected ? "border-primary/60 bg-primary/10 font-semibold" : "border-border hover:bg-accent",
              )}
            >
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {Math.round(b.w * 100)}&times;{Math.round(b.h * 100)}%
              </span>
            </button>
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
