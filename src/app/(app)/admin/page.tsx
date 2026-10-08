import { Suspense } from "react";
import Link from "next/link";
import { CreateDatasetForm } from "@/components/admin/create-dataset-form";
import { UsageMeter } from "@/components/admin/usage-meter";
import { card } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";

async function Datasets() {
  const supabase = await createClient();
  const { data: datasets } = await supabase
    .from("datasets").select("id, name, status, last_exported_at").order("created_at", { ascending: false });

  return (
      <section aria-labelledby="ds-h" className="space-y-3">
        <h2 id="ds-h" className="text-lg font-semibold">Datasets</h2>
        {(datasets ?? []).length === 0 && <p className="text-sm text-zinc-500">No datasets yet.</p>}
        <ul className="space-y-2">
          {(datasets ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/admin/d/${d.id}`} className={`${card} flex min-h-12 items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900`}>
                <span className="font-medium">{d.name}</span>
                <span className="text-sm text-zinc-500">{d.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
  );
}

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <UsageMeter />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading datasets...</p>}>
        <Datasets />
      </Suspense>
      <CreateDatasetForm />
    </div>
  );
}
