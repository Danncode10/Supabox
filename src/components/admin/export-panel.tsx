"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Folder, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExportStatusFilter } from "@/lib/yolo/build";
import { assignSplits, buildDataYaml } from "@/lib/yolo/split";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StatusCounts } from "./image-gallery";

const TRAIN_CMD = "yolo detect train data=data.yaml model=yolov8n.pt epochs=100 imgsz=640";

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "dataset";
}

/** Same split sizes the server computes (assignSplits is deterministic and only counts matter here). */
function splitCounts(n: number, val: number, test: number) {
  const out = { train: 0, val: 0, test: 0 };
  if (n === 0) return out;
  const dummy = Array.from({ length: n }, (_, i) => ({ number: i }));
  assignSplits(dummy, { train: 1 - val - test, val, test }).forEach((s) => out[s]++);
  return out;
}

function TreeRow({ depth, dir, name, note }: { depth: number; dir?: boolean; name: string; note?: string }) {
  const Icon = dir ? Folder : FileText;
  return (
    <li className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
      <Icon className={cn("size-4 shrink-0", dir ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="font-mono text-sm">{name}</span>
      {note && <span className="ml-auto pl-4 font-mono text-xs tabular-nums text-muted-foreground">{note}</span>}
    </li>
  );
}

export function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pl-4 pr-1">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{text}</code>
      <Button
        variant="ghost"
        size="icon-lg"
        className="md:size-8"
        aria-label={copied ? "Copied" : "Copy command"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked; the text is still selectable */
          }
        }}
      >
        {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </div>
  );
}

export function ExportPanel({
  datasetId,
  datasetName,
  counts,
  lastExportedAt,
  onChanged,
}: {
  datasetId: string;
  datasetName: string;
  counts: StatusCounts | null;
  lastExportedAt: string | null;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<ExportStatusFilter>("done");
  const [val, setVal] = useState("0.2");
  const [test, setTest] = useState("0");
  const [classes, setClasses] = useState<string[] | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let live = true;
    void createClient()
      .from("classes")
      .select("name, idx")
      .eq("dataset_id", datasetId)
      .order("idx")
      .then(({ data }) => live && setClasses((data ?? []).map((c) => c.name as string)));
    return () => {
      live = false;
    };
  }, [datasetId]);

  const v = Number(val);
  const t = Number(test);
  const n = counts ? (status === "done" ? counts.done : counts.done + counts.in_progress + counts.unlabeled) : 0;
  const left = counts ? counts.in_progress + counts.unlabeled : 0;
  const splits = useMemo(() => splitCounts(n, v, t), [n, v, t]);
  const hasTest = splits.test > 0;
  const valDir = splits.val > 0 ? "val" : "train";
  const yaml = buildDataYaml(classes ?? [], { test: hasTest, val: valDir });

  const href = `/api/export/${datasetId}?status=${status}&val=${v}&test=${t}`;
  const zipName = `${safeFilename(datasetName)}.zip`;
  const disabled = !counts || n === 0;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="ex-h" className="flex flex-col gap-6 rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-xs)] sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="ex-h" className="text-lg font-semibold tracking-tight">Download YOLOv8 dataset</h2>
          <p className="text-sm text-muted-foreground">
            One zip with images, one label .txt per image and a data.yaml, ready for Ultralytics.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">{counts ? n.toLocaleString("en-US") : "-"}</span>
          <span className="text-sm text-muted-foreground">
            image{n === 1 ? "" : "s"} in the zip: {splits.train} train, {splits.val} val{hasTest ? `, ${splits.test} test` : ""}
          </span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Include</legend>
          {(
            [
              { key: "done", label: "Done images only", detail: `${counts?.done ?? 0} images, recommended` },
              { key: "all", label: "Done and unfinished", detail: `${(counts?.done ?? 0) + left} images, unboxed ones train as background` },
            ] as const
          ).map((o) => (
            <label
              key={o.key}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-4 rounded-lg border px-4 py-2 transition-colors duration-150 has-focus-visible:ring-[3px] has-focus-visible:ring-ring",
                status === o.key ? "border-primary bg-accent" : "border-border hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="ex-status"
                value={o.key}
                checked={status === o.key}
                onChange={() => setStatus(o.key)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.detail}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Skipped images are never exported.</p>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Validation split" htmlFor="ex-val">
            <Select id="ex-val" value={val} onChange={(e) => setVal(e.target.value)}>
              {["0.1", "0.15", "0.2", "0.25", "0.3"].map((x) => (
                <option key={x} value={x}>{Math.round(Number(x) * 100)}%</option>
              ))}
            </Select>
          </Field>
          <Field label="Test split" htmlFor="ex-test">
            <Select id="ex-test" value={test} onChange={(e) => setTest(e.target.value)}>
              {["0", "0.1", "0.15", "0.2"].map((x) => (
                <option key={x} value={x}>{x === "0" ? "None" : `${Math.round(Number(x) * 100)}%`}</option>
              ))}
            </Select>
          </Field>
        </div>

        {counts && n === 0 && (
          <Alert variant="warning">
            <AlertTitle>Nothing to export yet</AlertTitle>
            <AlertDescription>
              {counts.done + left === 0
                ? "Upload images and label them first."
                : "No image is marked done. Finish some in the labeler, or include unfinished images."}
            </AlertDescription>
          </Alert>
        )}
        {classes && classes.length === 0 && n > 0 && (
          <Alert variant="warning">
            <AlertDescription>This dataset has no classes, so every label file will be empty.</AlertDescription>
          </Alert>
        )}
        {status === "done" && left > 0 && n > 0 && (
          <Alert variant="info">
            <AlertDescription>
              {left.toLocaleString("en-US")} unfinished image{left === 1 ? " is" : "s are"} left out.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          {disabled ? (
            <Button size="lg" disabled className="w-full">
              <Download aria-hidden />
              Download YOLOv8 .zip
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <a
                href={href}
                download={zipName}
                onClick={() => {
                  setStarted(true);
                  setTimeout(onChanged, 15000);
                }}
              >
                <Download aria-hidden />
                Download YOLOv8 .zip
              </a>
            </Button>
          )}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {started
              ? "Download started. Large datasets stream for a while; keep this tab open until it finishes."
              : lastExportedAt
                ? `Last exported ${new Date(lastExportedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                : "Not exported yet. A finished download marks the dataset exported."}
          </p>
          {started && (
            <Button variant="ghost" size="lg" className="self-start md:h-9" onClick={onChanged}>
              <RefreshCw aria-hidden />
              Refresh export status
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="ex-tree-h" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h3 id="ex-tree-h" className="text-sm font-semibold">What&apos;s in the zip</h3>
          <ul className="rounded-xl border border-border bg-card p-4" aria-label={`${zipName} contents`}>
            <TreeRow depth={0} dir name={zipName} />
            <TreeRow depth={1} name="data.yaml" note={`${classes?.length ?? 0} classes`} />
            <TreeRow depth={1} dir name="images/" />
            <TreeRow depth={2} dir name="train/" note={`${splits.train} .jpg/.png`} />
            <TreeRow depth={2} dir name="val/" note={`${splits.val}`} />
            {hasTest && <TreeRow depth={2} dir name="test/" note={`${splits.test}`} />}
            <TreeRow depth={1} dir name="labels/" />
            <TreeRow depth={2} dir name="train/" note={`${splits.train} .txt`} />
            <TreeRow depth={2} dir name="val/" note={`${splits.val} .txt`} />
            {hasTest && <TreeRow depth={2} dir name="test/" note={`${splits.test} .txt`} />}
          </ul>
          <p className="text-sm text-muted-foreground">
            Each .txt has one <code className="rounded-sm bg-muted px-1 font-mono text-xs text-foreground">class cx cy w h</code> line
            per box, normalized 0 to 1. An empty file means no boxes.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">data.yaml</h3>
          <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed">
            {classes === null ? "Loading classes..." : yaml}
          </pre>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Train it</h3>
          <p className="text-sm text-muted-foreground">Unzip, open a terminal in that folder, then run:</p>
          <CopyLine text={TRAIN_CMD} />
        </div>
      </section>
    </div>
  );
}
