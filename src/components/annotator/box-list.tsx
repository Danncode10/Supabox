"use client";

import type { ClassDef, DraftBox } from "@/lib/types";

interface Props {
  boxes: DraftBox[];
  classes: ClassDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BoxList({ boxes, classes, selectedId, onSelect, onDelete }: Props) {
  if (!boxes.length) return <p className="py-4 text-sm">No boxes yet. Drag on the image to draw one.</p>;
  const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";
  return (
    <ul className="grid gap-2 py-2" aria-label="Boxes">
      {boxes.map((b, i) => {
        const c = classes.find((x) => x.id === b.classId);
        const name = c?.name ?? "unknown";
        return (
          <li key={b.id} className="flex gap-2">
            <button
              type="button"
              aria-pressed={b.id === selectedId}
              onClick={() => onSelect(b.id)}
              className={`flex min-h-12 flex-1 items-center gap-3 rounded-lg border px-3 text-left text-sm ${ring} ${
                b.id === selectedId ? "border-foreground bg-foreground/10 font-semibold" : "border-foreground/20"
              }`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: c?.color ?? "#888888" }} aria-hidden="true" />
              <span className="flex-1 truncate">
                {i + 1}. {name}
              </span>
              <span className="text-xs tabular-nums opacity-70">{Math.round(b.w * 100)}x{Math.round(b.h * 100)}%</span>
            </button>
            <button
              type="button"
              aria-label={`Delete box ${i + 1}, ${name}`}
              onClick={() => onDelete(b.id)}
              className={`h-12 w-12 shrink-0 rounded-lg border border-foreground/20 text-lg ${ring}`}
            >
              &times;
            </button>
          </li>
        );
      })}
    </ul>
  );
}
