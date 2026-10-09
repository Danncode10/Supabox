import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { IMAGE_BUCKET } from "@/lib/types";
import { thumbPathOf } from "@/lib/thumbs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { deleteClasses?: boolean, newStart?: number, force?: boolean }
 * Calls reset_dataset (admin-checked in SQL, run as the user), then removes the returned
 * storage objects with the service-role client.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return fail(422, "invalid_dataset", "Invalid dataset id");

  const body = await request.json().catch(() => ({}));
  const newStart = body?.newStart;
  if (newStart !== undefined && newStart !== null && (!Number.isInteger(newStart) || newStart < 0)) {
    return fail(422, "invalid_start", "newStart must be a non-negative integer");
  }

  const { data, error } = await auth.supabase.rpc("reset_dataset", {
    p_dataset: id,
    p_delete_classes: body?.deleteClasses === true,
    p_new_start: newStart ?? null,
    p_force: body?.force === true,
  });
  if (error) {
    if (error.code === "P0002") return fail(404, "not_found", "Dataset not found");
    if (error.code === "P0001") return fail(409, "not_exported", "Export this dataset before resetting it");
    if (error.code === "42501") return fail(403, "forbidden", "Admin only");
    return fail(500, "reset_failed", error.message);
  }

  const imagePaths = (data as string[] | null) ?? [];
  const paths = imagePaths.flatMap((p) => [p, thumbPathOf(p)]);
  const admin = createAdminClient();
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data: gone, error: rmErr } = await admin.storage.from(IMAGE_BUCKET).remove(chunk);
    if (rmErr) return fail(500, "storage_cleanup_failed", `Database reset, but storage cleanup failed: ${rmErr.message}`);
    removed += gone?.length ?? 0;
  }
  return ok({ datasetId: id, imagesRemoved: imagePaths.length, objectsRemoved: removed });
}
