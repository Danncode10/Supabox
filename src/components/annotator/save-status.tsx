import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveState } from "./use-autosave";

const TEXT: Record<SaveState, string> = { idle: "", saving: "Saving...", saved: "Saved", error: "Save failed, retrying" };

/** Always-mounted live region so state changes are announced; icon-only on narrow screens. */
export function SaveStatus({ state, className }: { state: SaveState; className?: string }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex h-6 items-center gap-1.5 text-xs",
        state === "error" ? "text-danger" : state === "saved" ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      {state === "saving" && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {state === "saved" && <Check className="size-3.5" aria-hidden="true" />}
      {state === "error" && <AlertTriangle className="size-3.5" aria-hidden="true" />}
      <span className={cn(state !== "error" && "sr-only sm:not-sr-only")}>{TEXT[state]}</span>
    </span>
  );
}
