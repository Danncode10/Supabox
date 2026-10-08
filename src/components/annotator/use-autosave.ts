"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftBox } from "@/lib/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Options {
  imageId: string | null;
  boxes: DraftBox[];
  /** Edit counter; 0 means nothing to save. */
  rev: number;
  save: (imageId: string, boxes: DraftBox[]) => Promise<void>;
  delay?: number;
  retryDelay?: number;
}

/**
 * Debounced autosave. Saves are serialized, failures retry (and retry on `online`),
 * and pending edits flush on tab hide / page close.
 */
export function useAutosave({ imageId, boxes, rev, save, delay = 600, retryDelay = 3000 }: Options) {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef({ imageId, boxes });
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const saveRef = useRef(save);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    saveRef.current = save;
    latest.current = { imageId, boxes };
  });

  const flush = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current || !latest.current.imageId) return chain.current;
    pending.current = false;
    const { imageId: id, boxes: snapshot } = latest.current;
    setState("saving");
    chain.current = chain.current.then(async () => {
      try {
        await saveRef.current(id as string, snapshot);
        if (!pending.current) setState("saved");
      } catch {
        pending.current = true;
        setState("error");
        timer.current = setTimeout(() => void flushRef.current(), retryDelay);
      }
    });
    return chain.current;
  }, [retryDelay]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (rev === 0) return;
    pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }, [rev, delay, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onFlush = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onFlush);
    window.addEventListener("online", onFlush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onFlush);
      window.removeEventListener("online", onFlush);
      void flush();
    };
  }, [flush]);

  return { state, flush, reset: () => setState("idle") };
}
