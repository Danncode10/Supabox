import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { deleteImages, UUID_RE } from "@/lib/supabase/images";

const MAX_IDS = 500;

/**
 * DELETE /api/admin/images  body { ids: string[] } (1-500 uuids)
 * -> ApiResult<{ deleted: string[], objectsRemoved }>. Unknown ids are ignored (absent from `deleted`).
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (
    !Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS ||
    !ids.every((v): v is string => typeof v === "string" && UUID_RE.test(v))
  ) {
    return fail(422, "invalid_ids", `ids must be 1-${MAX_IDS} image uuids`);
  }

  const res = await deleteImages(auth, [...new Set(ids)]);
  if (!res.ok) return fail(500, res.code, res.message);
  return ok({ deleted: res.deleted.map((d) => d.id), objectsRemoved: res.objectsRemoved });
}
