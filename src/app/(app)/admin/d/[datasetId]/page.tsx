import { Suspense } from "react";
import { DatasetAdmin } from "@/components/admin/dataset-admin";

async function Content({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  return <DatasetAdmin datasetId={datasetId} />;
}

export default function AdminDatasetPage({ params }: { params: Promise<{ datasetId: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading...</p>}>
      <Content params={params} />
    </Suspense>
  );
}
