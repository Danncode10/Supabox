"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateDatasetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("image");
  const [start, setStart] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("datasets")
      .insert({ name: name.trim(), name_prefix: prefix.trim(), next_number: start, created_by: user?.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/admin/d/${data.id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>New dataset</h2></CardTitle>
        <CardDescription>Images are named prefix_0001, prefix_0002 and so on.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="ds-name">
            <Input id="ds-name" required placeholder="Street signs" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Image prefix" htmlFor="ds-prefix">
              <Input id="ds-prefix" required pattern="[A-Za-z0-9_\-]+" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </Field>
            <Field label="Start number" htmlFor="ds-start">
              <Input id="ds-start" type="number" min={0} inputMode="numeric" required value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </Field>
          </div>
          {err && (
            <Alert variant="danger">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <Button size="lg" loading={busy} disabled={!name.trim()} className="w-full">
            {!busy && <Plus aria-hidden />}
            {busy ? "Creating..." : "Create dataset"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
