import { Suspense } from "react";
import { DatasetAdmin, DatasetAdminSkeleton } from "@/components/admin/dataset-admin";
import { WORKSPACE_TABS, type WorkspaceTab } from "@/components/admin/dataset-stats";

type Props = {
  params: Promise<{ datasetId: string }>;
  searchParams: Promise<{ tab?: string; upload?: string }>;
};

async function Content({ params, searchParams }: Props) {
  const [{ datasetId }, { tab, upload }] = await Promise.all([params, searchParams]);
  const initialTab = (WORKSPACE_TABS as readonly string[]).includes(tab ?? "") ? (tab as WorkspaceTab) : "images";
  return (
    <DatasetAdmin
      key={datasetId}
      datasetId={datasetId}
      initialTab={upload === "1" ? "images" : initialTab}
      openUpload={upload === "1"}
    />
  );
}

export default function AdminDatasetPage(props: Props) {
  return (
    <Suspense fallback={<DatasetAdminSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
