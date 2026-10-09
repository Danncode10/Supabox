"use client";

import { useCallback, useEffect, useState } from "react";
import { HardDrive, RefreshCw } from "lucide-react";
import type { StorageUsage } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fmtBytes } from "./ui";

function Meter({ name, used, limit }: { name: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const tone = pct >= 95 ? "danger" : pct >= 80 ? "warning" : "primary";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{name}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
      </div>
      <Progress value={pct} tone={tone} aria-label={`${name} used`} />
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {fmtBytes(used)} of {fmtBytes(limit)}
      </span>
    </div>
  );
}

/** Compact free-tier panel: storage and database meters plus image and box totals. */
export function UsageMeter() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setUsage(await api<StorageUsage>("/api/admin/usage"));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  const worst = usage
    ? Math.max(usage.storageBytes / usage.storageLimitBytes, usage.dbBytes / usage.dbLimitBytes) * 100
    : 0;

  return (
    <section
      aria-labelledby="usage-h"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-xs)] sm:p-6 xl:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="usage-h" className="flex items-center gap-2 text-sm font-semibold">
          <HardDrive className="size-4 text-muted-foreground" aria-hidden />
          Free-tier usage
        </h2>
        <Button variant="ghost" size="icon-lg" className="-mr-2 md:size-8" onClick={() => void load()} disabled={busy} aria-label="Refresh usage">
          <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden />
        </Button>
      </div>

      {err && (
        <Alert variant="danger">
          <AlertDescription>Could not load usage: {err}</AlertDescription>
        </Alert>
      )}

      {!usage && !err && (
        <div className="flex flex-col gap-4" aria-busy aria-label="Loading usage">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-10" />
        </div>
      )}

      {usage && (
        <>
          <Meter name="Storage" used={usage.storageBytes} limit={usage.storageLimitBytes} />
          <Meter name="Database" used={usage.dbBytes} limit={usage.dbLimitBytes} />
          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Images</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{usage.imageCount.toLocaleString("en-US")}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Boxes</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{usage.boxCount.toLocaleString("en-US")}</dd>
            </div>
          </dl>
          {worst >= 80 && (
            <Alert variant={worst >= 95 ? "danger" : "warning"}>
              <AlertDescription>
                {worst >= 95
                  ? "Over 95%: uploads are blocked. Export and reset a dataset to free space."
                  : "Over 80% of the free tier. Export and reset a finished dataset soon."}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
