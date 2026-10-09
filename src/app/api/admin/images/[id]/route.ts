import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { deleteImages, UUID_RE } from "@/lib/supabase/images";

/**
 * DELETE /api/admin/images/[id]
 * -> ApiResult<{ id, storagePath, objectRemoved }>. Removes the row (annotations cascade) and its storage object.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return fail(422, "invalid_id", "Invalid image id");

  const res = await deleteImages(auth, [id]);
  if (!res.ok) return fail(500, res.code, res.message);
  const row = res.deleted[0];
  if (!row) return fail(404, "not_found", "Image not found");
  return ok({ id: row.id, storagePath: row.storagePath, objectRemoved: res.objectsRemoved > 0 });
}
