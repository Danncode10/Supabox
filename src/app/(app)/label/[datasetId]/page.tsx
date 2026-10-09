import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { WorkspaceSkeleton } from "@/components/annotator/workspace-skeleton";
import { LabelClient } from "./label-client";

export const metadata: Metadata = { title: "Label images" };
// Keep the editor from being zoomed by the browser; the canvas handles its own pinch zoom.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

async function Content({ params, searchParams }: PageProps<"/label/[datasetId]">) {
  const { datasetId } = await params;
  const { image } = await searchParams;
  return <LabelClient datasetId={datasetId} imageId={typeof image === "string" ? image : undefined} />;
}

/** The workspace is client-rendered; params and ?image= are request-time, so they resolve inside Suspense. */
export default function LabelPage(props: PageProps<"/label/[datasetId]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
