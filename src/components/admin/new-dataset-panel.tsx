"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDatasetForm } from "./create-dataset-form";

/** URL-driven (`/admin?new=1`) so every "New dataset" entry point opens the same inline form. */
export function NewDatasetButton() {
  return (
    <Button asChild size="lg" className="w-full sm:w-auto md:h-10">
      <Link href="/admin?new=1" scroll={false}>
        <Plus aria-hidden />
        New dataset
      </Link>
    </Button>
  );
}

export function NewDatasetPanel() {
  const params = useSearchParams();
  const router = useRouter();
  if (params.get("new") !== "1") return null;
  return <CreateDatasetForm onCancel={() => router.replace("/admin", { scroll: false })} />;
}
