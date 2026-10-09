import { AlertTriangle, Check, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveState } from "./use-autosave";

const TEXT: Record<SaveState, string> = { idle: "", saving: "Saving...", saved: "Saved", error: "Save failed, retrying" };

/**
 * Always-mounted live region so state changes are announced; icon-only on narrow screens.
 * When the browser is offline, edits stay in memory and autosave flushes them on reconnect.
 */
export function SaveStatus({ state, offline = false, className }: { state: SaveState; offline?: boolean; className?: string }) {
  const text = offline ? "Offline, changes will save when you reconnect" : TEXT[state];
  const warn = offline || state === "error";
  return (
    <span
      aria-live="polite"
      title={text || undefined}
      className={cn(
        "inline-flex h-6 min-w-0 items-center gap-1.5 text-xs",
        offline ? "text-warning" : state === "error" ? "text-danger" : state === "saved" ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      {offline ? (
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <>
          {state === "saving" && <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {state === "saved" && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
          {state === "error" && <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}
        </>
      )}
      <span className={cn("truncate", !warn && "sr-only sm:not-sr-only")}>{offline ? "Offline" : text}</span>
      {offline && <span className="sr-only">, changes will save when you reconnect</span>}
    </span>
  );
}
