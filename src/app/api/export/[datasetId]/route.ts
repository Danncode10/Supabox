import type { NextRequest } from "next/server";
import "@/lib/yolo-supabase";
import { getExportBackend } from "@/lib/yolo/backend";
import { planExport, type ExportStatusFilter } from "@/lib/yolo/build";
import { zipStream } from "@/lib/yolo/zip";
import type { ApiError } from "@/lib/types";

export const maxDuration = 300;

function fail(status: number, code: string, message: string): Response {
  const error: ApiError = { code, message };
  return Response.json({ data: null, error }, { status });
}

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "dataset";
}

function parseNum(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await ctx.params;
  const backend = await getExportBackend();
  if (!backend) return fail(501, "not_configured", "Export backend is not wired to Supabase yet");

  const user = await backend.getCurrentUser();
  if (!user) return fail(401, "unauthenticated", "Sign in required");
  if (user.role !== "admin") return fail(403, "forbidden", "Admin only");

  const name = await backend.getDatasetName(datasetId);
  if (name === null) return fail(404, "not_found", "Dataset not found");

  // Optional ?status=done|all&val=0.2&test=0.1&seed=7 ; train is the remainder.
  const sp = request.nextUrl.searchParams;
  const statusParam = sp.get("status") || "done";
  if (statusParam !== "done" && statusParam !== "all") {
    return fail(422, "invalid_params", "status must be done or all");
  }
  const status: ExportStatusFilter = statusParam;
  const val = parseNum(sp.get("val"));
  const test = parseNum(sp.get("test"));
  const seed = parseNum(sp.get("seed"));
  if ([val, test, seed].some((n) => Number.isNaN(n))) return fail(422, "invalid_params", "Bad numeric parameter");
  const v = val ?? 0.2;
  const t = test ?? 0;
  if (v + t >= 1) return fail(422, "invalid_params", "val + test must be less than 1");

  const plan = await planExport(datasetId, backend, {
    ratios: { train: 1 - v - t, val: v, test: t },
    seed: seed ?? undefined,
    status,
  });
  if (plan.imageCount === 0) {
    return fail(409, "nothing_to_export", status === "done" ? "No images are marked done" : "No exportable images");
  }

  const body = zipStream(plan.entries);
  // Mark exported once the stream has been fully handed to the client.
  const marked = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      async flush() {
        await backend.markExported(datasetId);
      },
    }),
  );

  return new Response(marked, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFilename(name)}.zip"`,
      "Cache-Control": "no-store",
      "X-Export-Images": String(plan.imageCount),
      "X-Export-Labels": String(plan.labelCount),
      "X-Export-Status": status,
    },
  });
}
