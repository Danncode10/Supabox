import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { UUID_RE } from "@/lib/supabase/images";
import { IMAGE_BUCKET } from "@/lib/types";

export type DeleteDatasetResult = { datasetId: string; imagesRemoved: number; objectsRemoved: number };

/** Every object under `<datasetId>/`, including orphans left by interrupted uploads. */
async function listDatasetObjects(admin: ReturnType<typeof createAdminClient>, datasetId: string) {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(IMAGE_BUCKET).list(datasetId, { limit: 1000, offset });
    if (error) throw error;
    paths.push(...(data ?? []).filter((o) => o.id).map((o) => `${datasetId}/${o.name}`));
    if (!data || data.length < 1000) return paths;
  }
}

/**
 * DELETE -> ApiResult<DeleteDatasetResult>
 * Permanently deletes a dataset: images (annotations cascade), then the dataset row
 * (classes cascade), then every storage object under `<datasetId>/` in the images bucket.
 * Images go before the dataset because annotations.class_id is ON DELETE RESTRICT.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return fail(422, "invalid_dataset", "Invalid dataset id");

  const { data: ds, error: dsErr } = await auth.supabase.from("datasets").select("id").eq("id", id).maybeSingle();
  if (dsErr) return fail(500, "delete_failed", dsErr.message);
  if (!ds) return fail(404, "not_found", "Dataset not found");

  const admin = createAdminClient();
  let paths: string[];
  try {
    paths = await listDatasetObjects(admin, id);
  } catch (e) {
    return fail(500, "storage_list_failed", `Nothing was deleted: could not list stored files (${(e as Error).message})`);
  }

  const { data: imgs, error: imgErr } = await auth.supabase.from("images").delete().eq("dataset_id", id).select("storage_path");
  if (imgErr) return fail(500, "delete_failed", imgErr.message);
  const { error: delErr } = await auth.supabase.from("datasets").delete().eq("id", id);
  if (delErr) return fail(500, "delete_failed", `Images deleted, but the dataset row was not: ${delErr.message}`);

  // Rows are gone first, so a storage failure leaves orphaned files, never rows pointing at missing files.
  const all = [...new Set([...paths, ...(imgs ?? []).map((r) => r.storage_path as string)])];
  let objectsRemoved = 0;
  for (let i = 0; i < all.length; i += 100) {
    const { data: gone, error: rmErr } = await admin.storage.from(IMAGE_BUCKET).remove(all.slice(i, i + 100));
    if (rmErr) {
      return fail(500, "storage_cleanup_failed", `Dataset deleted, but some files are still in the bucket: ${rmErr.message}`);
    }
    objectsRemoved += gone?.length ?? 0;
  }
  return ok<DeleteDatasetResult>({ datasetId: id, imagesRemoved: imgs?.length ?? 0, objectsRemoved });
}
