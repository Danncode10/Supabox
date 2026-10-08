import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { LabelClient } from "./label-client";

export const metadata: Metadata = { title: "Label images" };
// Keep the editor from being zoomed by the browser; the canvas handles its own pinch zoom.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ datasetId: string }>;
  searchParams: Promise<{ image?: string }>;
}) {
  const { datasetId } = await params;
  const { image } = await searchParams;
  return <LabelClient datasetId={datasetId} imageId={image} />;
}

export default function LabelPage(props: {
  params: Promise<{ datasetId: string }>;
  searchParams: Promise<{ image?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
