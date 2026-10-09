"use client";

import { createClient } from "./client";
import { IMAGE_BUCKET } from "@/lib/types";

/**
 * Signed URLs for the private images bucket, cached per tab (memory + sessionStorage).
 * Reusing the same URL is what lets the browser's HTTP cache serve an image again instead of
 * downloading it; a fresh token per visit defeats that cache.
 */
const TTL_S = 60 * 60;
const REUSE_MARGIN_MS = 10 * 60 * 1000;
const MISSING_MS = 5 * 60 * 1000;
const STORE_KEY = "supabox:signed-urls:v1";

type Entry = { url: string | null; exp: number };

let mem: Map<string, Entry> | null = null;
const inflight = new Map<string, Promise<void>>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function cache(): Map<string, Entry> {
  if (mem) return mem;
  mem = new Map();
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) if (v.url) mem.set(k, v);
  } catch {
    /* storage unavailable: memory only */
  }
  return mem;
}

function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const now = Date.now();
      const keep: Record<string, Entry> = {};
      for (const [k, v] of cache()) if (v.url && v.exp - REUSE_MARGIN_MS > now) keep[k] = v;
      sessionStorage.setItem(STORE_KEY, JSON.stringify(keep));
    } catch {
      /* quota or private mode: fine, memory still works */
    }
  }, 500);
}

function fresh(path: string): Entry | null {
  const e = cache().get(path);
  if (!e) return null;
  return e.exp - (e.url ? REUSE_MARGIN_MS : 0) > Date.now() ? e : null;
}

/** path -> signed URL, or null when the object does not exist. One request per batch of misses. */
export async function signedUrls(paths: string[]): Promise<Record<string, string | null>> {
  const want = [...new Set(paths)];
  const misses = want.filter((p) => !fresh(p) && !inflight.has(p));
  if (misses.length) {
    const job = (async () => {
      const { data, error } = await createClient().storage.from(IMAGE_BUCKET).createSignedUrls(misses, TTL_S);
      if (error) throw new Error(error.message);
      const now = Date.now();
      const got = new Set<string>();
      for (const row of data ?? []) {
        if (!row.path) continue;
        got.add(row.path);
        cache().set(row.path, row.signedUrl && !row.error ? { url: row.signedUrl, exp: now + TTL_S * 1000 } : { url: null, exp: now + MISSING_MS });
      }
      for (const p of misses) if (!got.has(p)) cache().set(p, { url: null, exp: now + MISSING_MS });
      persist();
    })();
    misses.forEach((p) => inflight.set(p, job));
    try {
      await job;
    } finally {
      misses.forEach((p) => inflight.delete(p));
    }
  }
  await Promise.all(want.map((p) => inflight.get(p)).filter(Boolean));
  const out: Record<string, string | null> = {};
  for (const p of want) out[p] = fresh(p)?.url ?? null;
  return out;
}

/** Drop cached entries (e.g. after a thumbnail is created or an image deleted). */
export function forgetSignedUrls(paths: string[]) {
  for (const p of paths) cache().delete(p);
  persist();
}
