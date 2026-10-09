"use client";

import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type SectionStat = { section: number; total: number; finished: number; first: string; last: string; openId: string };

/** Section switcher shown above the image list: "Section 1 of 3 · image_1 – image_50". */
export function SectionSwitcher({
  stats, index, onGo,
}: { stats: SectionStat[]; index: number; onGo: (i: number) => void }) {
  const s = stats[index];
  if (!s || stats.length < 2) return null;
  return (
    <div className="flex items-center gap-1 border-b border-border p-2">
      <Button variant="ghost" size="icon" aria-label="Previous section" disabled={index === 0} onClick={() => onGo(index - 1)}>
        <ChevronLeft />
      </Button>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-sm font-semibold">
          Section {s.section + 1} <span className="font-normal text-muted-foreground">of {stats.length}</span>
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{s.first} – {s.last}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Next section" disabled={index === stats.length - 1} onClick={() => onGo(index + 1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Lower-left footer of the image list: section progress plus "Proceed to Section N". */
export function SectionFooter({
  stats, index, onGo,
}: { stats: SectionStat[]; index: number; onGo: (i: number) => void }) {
  const s = stats[index];
  if (!s) return null;
  const next = stats[index + 1];
  const complete = s.finished === s.total;
  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{stats.length > 1 ? `Section ${s.section + 1}` : "Progress"}</span>
        <span className={cn("font-mono tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
          {s.finished}/{s.total}
        </span>
      </div>
      <Progress value={s.total ? (s.finished / s.total) * 100 : 0} tone={complete ? "success" : "primary"} className="h-1.5" aria-label="Section progress" />
      {next && (
        <Button variant={complete ? "default" : "outline"} size="lg" className="mt-1 w-full" onClick={() => onGo(index + 1)}>
          Proceed to Section {next.section + 1}
          <ArrowRight />
        </Button>
      )}
    </div>
  );
}

/** Floating card over the canvas (lower left) once every image in the section is done or skipped. */
export function SectionCompleteCard({
  stats, index, onGo, exportHref,
}: { stats: SectionStat[]; index: number; onGo: (i: number) => void; exportHref: string | null }) {
  const s = stats[index];
  if (!s || s.finished !== s.total) return null;
  const next = stats[index + 1];
  const allDone = stats.every((x) => x.finished === x.total);
  if (!next && !allDone) return null;
  return (
    <div
      role="status"
      className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-border bg-popover p-3 pr-4 [box-shadow:var(--inset-highlight),var(--elev-md)] max-lg:bottom-2 max-lg:left-2 max-lg:right-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/14 text-success">
        {allDone ? <PartyPopper className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {allDone ? "Every image is labeled" : `Section ${s.section + 1} complete`}
        </p>
        <p className="text-xs text-muted-foreground">
          {allDone ? "Ready to export or train." : `${s.finished} of ${s.total} done`}
        </p>
      </div>
      {next ? (
        <Button size="lg" className="shrink-0 md:h-10" onClick={() => onGo(index + 1)}>
          Section {next.section + 1}
          <ArrowRight />
        </Button>
      ) : exportHref ? (
        <Button asChild size="lg" variant="outline" className="shrink-0 md:h-10">
          <Link href={exportHref}>Export</Link>
        </Button>
      ) : null}
    </div>
  );
}
