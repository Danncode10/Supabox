import "server-only";
import { IMAGE_BUCKET } from "@/lib/types";
import { createAdminClient } from "./admin";
import type { AuthContext } from "./api";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeleteImagesResult =
  | { ok: true; deleted: Array<{ id: string; storagePath: string }>; objectsRemoved: number }
  | { ok: false; code: "delete_failed" | "storage_cleanup_failed"; message: string };

/**
 * Delete image rows (annotations cascade) as the signed-in admin (RLS: images_admin_delete),
 * then remove their storage objects. Rows go first so a storage hiccup leaves at worst an
 * orphaned object, never a row that points at a missing file.
 * Caller must have verified admin (requireAdmin) before calling.
 */
export async function deleteImages(ctx: AuthContext, ids: string[]): Promise<DeleteImagesResult> {
  const { data, error } = await ctx.supabase.from("images").delete().in("id", ids).select("id, storage_path");
  if (error) return { ok: false, code: "delete_failed", message: error.message };
  const deleted = (data ?? []).map((r) => ({ id: r.id as string, storagePath: r.storage_path as string }));
  if (deleted.length === 0) return { ok: true, deleted, objectsRemoved: 0 };

  // Service role for the Storage API call; the admin check already happened above and in RLS.
  const admin = createAdminClient();
  let objectsRemoved = 0;
  const paths = deleted.map((d) => d.storagePath);
  for (let i = 0; i < paths.length; i += 100) {
    const { data: gone, error: rmErr } = await admin.storage.from(IMAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (rmErr) {
      return {
        ok: false,
        code: "storage_cleanup_failed",
        message: `Image rows deleted, but storage cleanup failed: ${rmErr.message}`,
      };
    }
    objectsRemoved += gone?.length ?? 0;
  }
  return { ok: true, deleted, objectsRemoved };
}
