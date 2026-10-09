"use client";

import { forwardRef, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, ImagePlus, Loader2, X, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, MAX_SIDE, UPLOAD_BATCH, type Uploader } from "./use-uploader";

/**
 * Large dropzone used for an empty dataset and when arriving with `?upload=1`.
 * The label wraps a hidden file input, so click, Enter/Space (via the input) and drop all work.
 */
export const UploadDropzone = forwardRef<
  HTMLInputElement,
  { inputId: string; busy: boolean; onFiles: (files: FileList | null) => void; className?: string; hint?: React.ReactNode }
>(function UploadDropzone({ inputId, busy, onFiles, className, hint }, ref) {
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!busy) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-input bg-card px-4 py-10 text-center transition-[border-color,background-color] duration-150 ease-out-strong focus-within:ring-[3px] focus-within:ring-ring hover:border-primary hover:bg-accent",
        over && "border-primary bg-accent",
        busy && "pointer-events-none opacity-60",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl border border-border bg-background text-primary [box-shadow:var(--inset-highlight),var(--elev-sm)]">
        <ImagePlus className="size-6" aria-hidden />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-semibold">Drop images here, or click to choose</span>
        <span className="text-sm text-muted-foreground">
          {hint ?? "JPEG, PNG, WebP, HEIC and more. Converted to JPEG, saved to the Supabase images bucket and renamed in order."}
        </span>
      </span>
      <span className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)] md:h-10 md:px-4 md:text-sm">
        Choose images
      </span>
      <input
        ref={ref}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
});

/** States the storage policy so admins know what lands in the bucket. */
export function UploadNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Every image, HEIC included, is converted to a JPEG of at most {MAX_SIDE}px before upload, to keep free-tier storage low.
    </p>
  );
}

const stateIcon = {
  queued: <CircleDashed className="size-4 text-muted-foreground" aria-hidden />,
  uploading: <Loader2 className="size-4 animate-spin text-primary" aria-hidden />,
  done: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  error: <XCircle className="size-4 text-danger" aria-hidden />,
} as const;

/** Upload progress strip with an expandable per-file log. */
export function UploadQueue({ uploader }: { uploader: Uploader }) {
  const { items, busy, err, clear } = uploader;
  const [open, setOpen] = useState(false);
  if (items.length === 0 && !err) return null;

  const done = items.filter((i) => i.state === "done").length;
  const failed = items.filter((i) => i.state === "error").length;
  const pct = items.length ? (done / items.length) * 100 : 0;
  const summary = busy
    ? `Uploading ${done} of ${items.length}`
    : failed
      ? `${done} uploaded, ${failed} failed`
      : `${done} image${done === 1 ? "" : "s"} uploaded`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-xs)]" role="region" aria-label="Upload progress">
      <div className="flex items-center gap-4">
        <span aria-hidden>{busy ? stateIcon.uploading : failed ? stateIcon.error : stateIcon.done}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium" aria-live="polite">{summary}</span>
            {items.length > UPLOAD_BATCH && <span className="text-xs text-muted-foreground">in batches of {UPLOAD_BATCH}</span>}
          </div>
          <Progress value={pct} tone={!busy && failed ? "warning" : busy ? "primary" : "success"} aria-label="Upload progress" />
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          className="md:size-10"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="upload-log"
          aria-label={open ? "Hide file list" : "Show file list"}
        >
          <ChevronDown className={cn("transition-transform duration-200 ease-out-strong", open && "rotate-180")} aria-hidden />
        </Button>
        {!busy && (
          <Button variant="ghost" size="icon-lg" className="md:size-10" onClick={clear} aria-label="Dismiss upload summary">
            <X aria-hidden />
          </Button>
        )}
      </div>

      {err && (
        <Alert variant="danger">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {open && (
        <ul id="upload-log" className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
          {items.map((it, i) => (
            <li key={i} className={cn("flex items-center gap-2 px-4 py-2", it.state === "error" && "text-danger")}>
              {stateIcon[it.state]}
              <span className="min-w-0 flex-1 truncate">{it.note ?? it.name}</span>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{it.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
