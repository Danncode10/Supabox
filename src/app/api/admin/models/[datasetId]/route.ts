import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { UUID_RE } from "@/lib/supabase/images";

export type LocalModelMeta = {
  names?: string[];
  imgsz?: number;
  baseModel?: string;
  epochs?: number;
  device?: string;
  trainedAt?: string;
  mAP50?: number | null;
  mAP50_95?: number | null;
};

export type LocalModelStatus =
  | { available: false }
  | { available: true; bytes: number; updatedAt: string; meta: LocalModelMeta | null };

/**
 * Models trained by scripts/train_local.py live in the gitignored models/<datasetId>/ folder,
 * so they only exist where the repo is checked out (localhost).
 *   GET            -> ApiResult<LocalModelStatus>
 *   GET ?file=1    -> best.onnx bytes (application/octet-stream)
 */
export async function GET(request: Request, ctx: { params: Promise<{ datasetId: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { datasetId } = await ctx.params;
  if (!UUID_RE.test(datasetId)) return fail(422, "invalid_dataset", "Invalid dataset id");

  const dir = path.join(process.cwd(), "models", datasetId.toLowerCase());
  const onnx = path.join(dir, "best.onnx");
  const info = await stat(onnx).catch(() => null);

  if (new URL(request.url).searchParams.get("file") === "1") {
    if (!info) return fail(404, "no_model", "No local model for this dataset");
    return new Response(new Uint8Array(await readFile(onnx)), {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
    });
  }

  if (!info) return ok<LocalModelStatus>({ available: false });
  const meta = await readFile(path.join(dir, "meta.json"), "utf8")
    .then((t) => JSON.parse(t) as LocalModelMeta)
    .catch(() => null);
  return ok<LocalModelStatus>({ available: true, bytes: info.size, updatedAt: info.mtime.toISOString(), meta });
}
