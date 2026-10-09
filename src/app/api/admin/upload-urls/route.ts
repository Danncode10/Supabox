import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { FREE_TIER, IMAGE_BUCKET } from "@/lib/types";

const EXTS = ["jpg", "jpeg", "png", "webp"];
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ext wins when valid; otherwise fall back to the MIME type (files named without/with odd extensions). */
function resolveExt(f: unknown): string {
  const o = (f ?? {}) as { ext?: unknown; type?: unknown };
  const ext = String(o.ext ?? "").toLowerCase().replace(/^\./, "");
  if (EXTS.includes(ext)) return ext;
  return MIME_EXT[String(o.type ?? "").toLowerCase()] ?? ext;
}

export type UploadUrl = { number: number; name: string; path: string; token: string; signedUrl: string };

/**
 * POST { datasetId, files: [{ ext, type? }] } -> ApiResult<UploadUrl[]>
 * `type` (MIME) is an optional fallback when `ext` is missing or not one of jpg/jpeg/png/webp.
 * Atomically allocates image numbers, blocks when storage >= 95%, returns signed upload URLs.
 * Client then: supabase.storage.from("images").uploadToSignedUrl(path, token, blob), and
 * inserts the `images` row (admin RLS) with name/number/storage_path/width/height/bytes.
 */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const body = await request.json().catch(() => null);
  const datasetId: unknown = body?.datasetId;
  const files: unknown = body?.files;
  if (typeof datasetId !== "string" || !UUID_RE.test(datasetId)) return fail(422, "invalid_dataset", "datasetId required");
  if (!Array.isArray(files) || files.length < 1 || files.length > 200) return fail(422, "invalid_files", "1-200 files required");
  const exts = files.map(resolveExt);
  if (exts.some((e) => !EXTS.includes(e))) return fail(422, "invalid_ext", `ext must be one of ${EXTS.join(", ")}`);

  const { data: usage } = await ctx.supabase.rpc("storage_usage");
  const used = Number((usage as { storageBytes?: number } | null)?.storageBytes ?? 0);
  if (used >= FREE_TIER.storageBytes * 0.95) {
    return fail(409, "storage_full", "Storage is over 95% of the free tier. Export and reset a dataset first.");
  }

  const { data: alloc, error } = await ctx.supabase
    .rpc("allocate_image_numbers", { p_dataset: datasetId, p_count: exts.length })
    .single<{ start_number: number; name_prefix: string; number_pad: number }>();
  if (error || !alloc) return fail(error?.code === "P0002" ? 404 : 500, "allocate_failed", error?.message ?? "allocation failed");

  const admin = createAdminClient();
  const out: UploadUrl[] = [];
  for (let i = 0; i < exts.length; i++) {
    const number = alloc.start_number + i;
    const name = `${alloc.name_prefix}_${String(number).padStart(alloc.number_pad, "0")}`;
    const ext = exts[i] === "jpeg" ? "jpg" : exts[i];
    const path = `${datasetId}/${name}.${ext}`;
    const { data, error: signErr } = await admin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
    if (signErr || !data) return fail(500, "sign_failed", signErr?.message ?? "could not sign");
    out.push({ number, name, path, token: data.token, signedUrl: data.signedUrl });
  }
  return ok(out, 201);
}
