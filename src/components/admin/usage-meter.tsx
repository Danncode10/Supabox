"use client";

import { useEffect, useState } from "react";
import { Boxes, Database, HardDrive, Images } from "lucide-react";
import type { StorageUsage } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BlurFade } from "@/components/ui/blur-fade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { api, fmtBytes } from "./ui";

function Meter({ name, used, limit }: { name: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 95 ? "full" : pct >= 80 ? "warn" : "ok";
  const tone = level === "full" ? "danger" : level === "warn" ? "warning" : "primary";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{name}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {fmtBytes(used)} / {fmtBytes(limit)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <Progress value={pct} tone={tone} aria-label={name} className="h-2.5" />
      {level !== "ok" && (
        <Alert variant={level === "full" ? "danger" : "warning"}>
          <AlertDescription>
            {level === "full"
              ? "Over 95%: uploads are blocked. Export and reset a dataset to free space."
              : "Over 80% of the free tier. Plan to export and reset soon."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function pctOf(used: number, limit: number) {
  return Math.min(100, (used / limit) * 100);
}

export function UsageMeter() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<StorageUsage>("/api/admin/usage").then(setUsage).catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <section aria-labelledby="usage-h" className="flex flex-col gap-4">
      <h2 id="usage-h" className="sr-only">Free-tier usage</h2>

      {err && (
        <Alert variant="danger">
          <AlertTitle>Could not load usage</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {!usage && !err && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-xl" />
        </>
      )}

      {usage && (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Images", icon: <Images />, value: <NumberTicker value={usage.imageCount} />, detail: "uploaded" },
              { label: "Boxes", icon: <Boxes />, value: <NumberTicker value={usage.boxCount} />, detail: "annotated" },
              {
                label: "Storage",
                icon: <HardDrive />,
                value: (<><NumberTicker value={pctOf(usage.storageBytes, usage.storageLimitBytes)} decimalPlaces={1} />%</>),
                detail: fmtBytes(usage.storageBytes),
              },
              {
                label: "Database",
                icon: <Database />,
                value: (<><NumberTicker value={pctOf(usage.dbBytes, usage.dbLimitBytes)} decimalPlaces={1} />%</>),
                detail: fmtBytes(usage.dbBytes),
              },
            ].map((s, i) => (
              <li key={s.label}>
                <BlurFade delay={i * 0.05} className="h-full">
                  <div className="h-full rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-xs)]">
                    <Stat label={s.label} icon={s.icon} value={s.value} detail={s.detail} />
                  </div>
                </BlurFade>
              </li>
            ))}
          </ul>

          <BlurFade delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle>Free-tier usage</CardTitle>
                <CardDescription>Uploads are blocked above 95% of either limit.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Meter name="Storage" used={usage.storageBytes} limit={usage.storageLimitBytes} />
                <Meter name="Database" used={usage.dbBytes} limit={usage.dbLimitBytes} />
              </CardContent>
            </Card>
          </BlurFade>
        </>
      )}
    </section>
  );
}
