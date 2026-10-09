"use client";

import { Keyboard } from "lucide-react";
import { Popover } from "radix-ui";
import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["1", "9"], label: "Pick class (applies to the selected box)" },
  { keys: ["A", "D"], label: "Previous / next image" },
  { keys: ["←", "→"], label: "Previous / next image (nudge when a box is selected)" },
  { keys: ["Enter"], label: "Mark done and go to the next image" },
  { keys: ["S"], label: "Skip image" },
  { keys: ["Del"], label: "Delete selected box" },
  { keys: ["Esc"], label: "Deselect box" },
  { keys: ["Ctrl", "Z"], label: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
  { keys: ["Space"], label: "Hold and drag to pan" },
  { keys: ["+", "-"], label: "Zoom in / out (or scroll)" },
  { keys: ["0"], label: "Fit image" },
  { keys: ["?"], label: "Show this list" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsPopover({ open, onOpenChange }: Props) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "data-[state=open]:bg-accent")}
      >
        <Keyboard />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-80 rounded-xl border border-border bg-popover p-4 text-popover-foreground [box-shadow:var(--inset-highlight),var(--elev-lg)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Keyboard shortcuts</h2>
          <dl className="grid gap-2 text-xs">
            {SHORTCUTS.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="flex shrink-0 items-center gap-1">
                  {s.keys.map((k, i) => (
                    <Kbd key={i}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
