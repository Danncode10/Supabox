"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Dumbbell, Square } from "lucide-react";
import type { TrainingStatus } from "@/app/api/admin/train/[datasetId]/route";
import type { TrainState } from "@/lib/training";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { api } from "./ui";

const EPOCHS = [25, 50, 100] as const;

/** Overall 0-100: images 0-10, training 10-95, conversion 95-100. */
export function overallPercent(t: { state: string; prepared?: number; total?: number; epoch?: number; epochs?: number }): number {
  if (t.state === "preparing") return t.total ? Math.min(10, (t.prepared ?? 0) / t.total * 10) : 1;
  if (t.state === "training") return 10 + ((t.epoch ?? 0) / (t.epochs || 1)) * 85;
  if (t.state === "exporting") return 97;
  if (t.state === "done") return 100;
  return 0;
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

const STEPS = [
  { key: "preparing", label: "Download images" },
  { key: "training", label: "Train" },
  { key: "exporting", label: "Finish" },
] as const;

function Steps({ state }: { state: string }) {
  const at = STEPS.findIndex((s) => s.key === state);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Training steps">
      {STEPS.map((st, i) => {
        const done = i < at;
        const cur = i === at;
        return (
          <li key={st.key} aria-current={cur ? "step" : undefined} className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                done && "border-success bg-success text-background",
                cur && "border-primary bg-primary text-primary-foreground",
                !done && !cur && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : cur ? <Spinner className="size-3.5 text-primary-foreground" /> : i + 1}
            </span>
            <span className={cn("truncate", cur ? "font-medium" : "text-muted-foreground")}>{st.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Busy({ label, className }: { label: string; className?: string }) {
  return <div role="progressbar" aria-label={label} aria-busy className={`h-2.5 animate-pulse rounded-full bg-primary/50 ${className ?? ""}`} />;
}
const ACTIVE = new Set(["preparing", "training", "exporting"]);

/**
 * One-click local training: "Set up" once (installs YOLO into .venv), then "Train" with live
 * progress. Calls onModelReady when a new model finishes so the tab loads it.
 * Renders nothing when the app is not running on localhost (training needs this machine).
 */
export function TrainCard({
  datasetId, doneImages, onModelReady, onUnavailable,
}: { datasetId: string; doneImages: number | null; onModelReady: () => void; onUnavailable: () => void }) {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [epochs, setEpochs] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const prevState = useRef<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  const [clicked, setClicked] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<TrainingStatus>(`/api/admin/train/${datasetId}`);
      setStatus(s);
      if (!s.allowed) onUnavailable();
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [datasetId, onUnavailable]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial status fetch
  useEffect(() => { void refresh(); }, [refresh]);

  const running =
    busy || (status?.allowed === true && (status.setup.job === "running" || ACTIVE.has(status.train.state)));

  const live = busy || (status?.allowed === true && (status.setup.job === "running" || ACTIVE.has(status.train.state)));
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  // Poll while something is running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [running, refresh]);

  // A fresh model just finished: hand it to the tester.
  const trainState = status?.allowed ? status.train.state : null;
  useEffect(() => {
    if (trainState === "done" && prevState.current && prevState.current !== "done") onModelReady();
    prevState.current = trainState;
  }, [trainState, onModelReady]);

  async function act(action: "setup" | "train" | "stop") {
    if (action === "stop") setStopping(true);
    else setBusy(true);
    if (action === "train") setClicked(Date.now());
    setErr(null);
    try {
      const next = await api<TrainingStatus>(`/api/admin/train/${datasetId}`, { method: "POST", body: JSON.stringify({ action, epochs }) });
      setStatus((cur) => {
        // A poll may have landed first with fresher progress; keep whichever was updated last.
        if (cur?.allowed && next.allowed && cur.train.updatedAt && next.train.updatedAt && cur.train.updatedAt > next.train.updatedAt) {
          return { ...next, train: cur.train };
        }
        return next;
      });
    } catch (e) {
      setErr((e as Error).message);
      void refresh();
    }
    setBusy(false);
    setStopping(false);
    setClicked(null);
  }

  if (!status) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Checking this Mac…
      </p>
    );
  }
  if (!status.allowed) return null;

  const { setup, train } = status;

  // Step 1: one-time install.
  if (!setup.ready) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">One-time setup</h3>
          <p className="text-sm text-muted-foreground">
            Installs YOLO on this Mac so it can train. About 1 GB download, a few minutes. You only do this once.
          </p>
        </div>
        {!setup.python ? (
          <Alert variant="warning">
            <AlertDescription>
              Python 3 was not found. Install it from python.org, then reload this page.
            </AlertDescription>
          </Alert>
        ) : setup.job === "running" ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Busy label="Installing YOLO" />
            <p className="truncate font-mono text-xs text-muted-foreground">{setup.message || "Installing…"}</p>
          </div>
        ) : (
          <>
            {setup.job === "error" && (
              <Alert variant="danger">
                <AlertDescription className="whitespace-pre-wrap break-words font-mono text-xs">
                  Setup did not finish (often a slow download). Click Set up again; it resumes.{"\n"}
                  {setup.message}
                </AlertDescription>
              </Alert>
            )}
            <Button size="lg" className="w-full sm:w-auto" loading={busy} onClick={() => void act("setup")}>
              {!busy && <Download aria-hidden />}
              Set up
            </Button>
          </>
        )}
      </div>
    );
  }

  // Step 2: train.
  const active = ACTIVE.has(train.state);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Train a model</h3>
        <p className="text-sm text-muted-foreground">
          Uses the latest labels ({doneImages ?? "…"} done images) and this Mac&apos;s GPU. No zip needed.
        </p>
      </div>

      {active || busy ? (
        <ActiveRun train={active ? train : { state: "preparing" }} now={now} clicked={clicked} stopping={stopping} onStop={() => void act("stop")} />
      ) : (
        <div className="flex flex-col gap-3">
          {train.state === "done" && (
            <Alert variant="success">
              <AlertDescription className="text-foreground">
                Trained on {train.images ?? "your"} images
                {train.mAP50 != null && <>, accuracy (mAP50) {(train.mAP50 * 100).toFixed(0)}%</>}. The model is loaded below.
              </AlertDescription>
            </Alert>
          )}
          {train.state === "error" && (
            <Alert variant="danger">
              <AlertDescription className="whitespace-pre-wrap break-words font-mono text-xs">{train.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Training length
              <select
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="h-12 rounded-lg border border-input bg-background px-3 text-sm md:h-10"
              >
                {EPOCHS.map((n) => (
                  <option key={n} value={n}>
                    {n === 25 ? "Quick (25 epochs)" : n === 50 ? "Normal (50 epochs)" : "Thorough (100 epochs)"}
                  </option>
                ))}
              </select>
            </label>
            <Button size="lg" className="md:h-10" loading={busy} disabled={doneImages === 0} onClick={() => void act("train")}>
              {!busy && <Dumbbell aria-hidden />}
              {busy ? "Preparing images…" : train.state === "done" ? "Train again" : "Train"}
            </Button>
          </div>
          {doneImages === 0 && <p className="text-sm text-muted-foreground">Mark some images done in the labeler first.</p>}
        </div>
      )}

      {err && (
        <Alert variant="danger">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ActiveRun({
  train, now, clicked, stopping, onStop,
}: { train: TrainState; now: number; clicked: number | null; stopping: boolean; onStop: () => void }) {
  const started = train.startedAt ? Date.parse(train.startedAt) : clicked ?? now;
  const elapsed = now - started;
  const pct = overallPercent(train);
  const epochsDone = train.state === "training" ? train.epoch ?? 0 : 0;
  // Estimate from the pace of epochs so far (the first epochs include warm-up, so it is rough).
  const perEpoch = epochsDone > 1 ? (now - started) / Math.max(1, epochsDone + 0.5) : null;
  const eta = perEpoch && train.epochs ? perEpoch * (train.epochs - epochsDone) : null;
  const headline =
    train.state === "preparing"
      ? train.total
        ? `Downloading your images (${train.prepared ?? 0} of ${train.total} files)`
        : "Getting your labeled images ready…"
      : train.state === "exporting"
        ? "Converting the model for the browser…"
        : epochsDone
          ? `Training: epoch ${epochsDone} of ${train.epochs}`
          : "Starting the trainer…";
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Steps state={train.state} />
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium">{headline}</span>
          <span className="font-mono text-lg font-semibold tabular-nums">{Math.round(pct)}%</span>
        </div>
        {pct > 1 ? <Progress value={pct} aria-label="Training progress" className="h-3" /> : <Busy label="Training progress" className="h-3" />}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span>
            {fmtDuration(elapsed)} elapsed{eta ? ` · about ${fmtDuration(eta)} left` : ""}
          </span>
          {train.mAP50 != null && <span>accuracy (mAP50) {(train.mAP50 * 100).toFixed(0)}%</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">You can leave this page; training keeps running.</span>
        <Button variant="outline" size="lg" className="md:h-9" loading={stopping} onClick={onStop}>
          {!stopping && <Square aria-hidden />}
          Stop
        </Button>
      </div>
    </div>
  );
}
