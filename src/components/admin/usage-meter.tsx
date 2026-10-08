"use client";

import { useEffect, useState } from "react";
import type { StorageUsage } from "@/lib/types";
import { api, card, fmtBytes } from "./ui";

function Meter({ name, used, limit }: { name: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 95 ? "full" : pct >= 80 ? "warn" : "ok";
  const color = level === "full" ? "bg-red-600" : level === "warn" ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span>{fmtBytes(used)} / {fmtBytes(limit)} ({pct.toFixed(1)}%)</span>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {level !== "ok" && (
        <p role="status" className={`mt-1 text-sm ${level === "full" ? "text-red-600" : "text-amber-600"}`}>
          {level === "full"
            ? "Over 95%: uploads are blocked. Export and reset a dataset to free space."
            : "Over 80% of the free tier. Plan to export and reset soon."}
        </p>
      )}
    </div>
  );
}

export function UsageMeter() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<StorageUsage>("/api/admin/usage").then(setUsage).catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <section className={`${card} space-y-4`} aria-labelledby="usage-h">
      <h2 id="usage-h" className="text-lg font-semibold">Free-tier usage</h2>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {!usage && !err && <p className="text-sm text-zinc-500">Loading...</p>}
      {usage && (
        <>
          <Meter name="Storage" used={usage.storageBytes} limit={usage.storageLimitBytes} />
          <Meter name="Database" used={usage.dbBytes} limit={usage.dbLimitBytes} />
          <p className="text-sm text-zinc-500">{usage.imageCount} images, {usage.boxCount} boxes</p>
        </>
      )}
    </section>
  );
}
