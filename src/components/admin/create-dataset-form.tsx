"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Inline create form. On success it lands on the dataset's Images tab with the file picker
 * ready (`?tab=images&upload=1`), so creating a dataset flows straight into uploading.
 */
export function CreateDatasetForm({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("image");
  const [start, setStart] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const startNum = Number(start);
  const prefixOk = /^[A-Za-z0-9_-]+$/.test(prefix.trim());
  const valid = name.trim() !== "" && prefixOk && Number.isInteger(startNum) && startNum >= 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("datasets")
      .insert({ name: name.trim(), name_prefix: prefix.trim(), next_number: startNum, created_by: user?.id })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    router.push(`/admin/d/${data.id}?tab=images&upload=1`);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) onCancel();
      }}
      aria-labelledby="new-ds-h"
      className="flex flex-col gap-6 rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-sm)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="new-ds-h" className="text-lg font-semibold tracking-tight">New dataset</h2>
          <p className="text-sm text-muted-foreground">
            Uploaded files are renamed{" "}
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {(prefixOk ? prefix.trim() : "image") + "_" + (Number.isInteger(startNum) ? startNum : 1)}
            </code>
            , then counting up.
          </p>
        </div>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon-lg" className="-mr-2 -mt-2 md:size-10" onClick={onCancel} aria-label="Close">
            <X aria-hidden />
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={<>Name <span className="text-danger" aria-hidden>*</span></>} htmlFor="ds-name">
          <Input
            ref={nameRef}
            id="ds-name"
            required
            placeholder="Street signs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Image prefix" htmlFor="ds-prefix" error={prefixOk ? undefined : "Letters, numbers, _ and - only"}>
          <Input
            id="ds-prefix"
            required
            aria-invalid={!prefixOk || undefined}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </Field>
        <Field label="Start number" htmlFor="ds-start">
          <Input id="ds-start" type="number" min={0} inputMode="numeric" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </div>

      {err && (
        <Alert variant="danger">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} className="md:h-10">
            Cancel
          </Button>
        )}
        <Button size="lg" loading={busy} disabled={!valid} className="md:h-10">
          {busy ? "Creating..." : "Create and upload images"}
          {!busy && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
