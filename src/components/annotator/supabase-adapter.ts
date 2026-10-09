import { createClient } from "@/lib/supabase/client";
import { normalizeBox } from "@/lib/yolo/convert";
import { IMAGE_BUCKET, type ClassDef, type DraftBox, type ImageRecord, type ImageStatus } from "@/lib/types";
import type { AnnotatorAdapter } from "./adapter";

const PAGE = 1000;
/** Signed URL lifetime, and how long before expiry we stop reusing a cached one. */
const URL_TTL_S = 3600;
const URL_MARGIN_MS = 5 * 60 * 1000;

type Client = ReturnType<typeof createClient>;

/**
 * Browser-side adapter on supabase-js. Every query runs as the signed-in user, so RLS decides
 * what is visible: members read datasets/classes/images/annotations, write annotations and
 * image status; only admins change anything else.
 */
export function createSupabaseAdapter(): AnnotatorAdapter {
  // Lazy so the client is never built while the page is server-rendered.
  let sb: Client | null = null;
  const db = () => (sb ??= createClient());

  const paths = new Map<string, string>();
  const urls = new Map<string, { url: string; exp: number }>();
  let uid: string | null = null;

  async function userId() {
    if (uid) return uid;
    const { data } = await db().auth.getSession();
    uid = data.session?.user.id ?? null;
    if (!uid) throw new Error("Your session expired. Sign in again to keep saving.");
    return uid;
  }

  function cached(path: string) {
    const hit = urls.get(path);
    return hit && hit.exp - URL_MARGIN_MS > Date.now() ? hit.url : null;
  }

  async function signedUrls(imageIds: string[]) {
    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of imageIds) {
      const p = paths.get(id);
      if (!p) continue;
      const u = cached(p);
      if (u) out[id] = u;
      else missing.push(p);
    }
    if (missing.length) {
      const { data, error } = await db().storage.from(IMAGE_BUCKET).createSignedUrls(missing, URL_TTL_S);
      if (error) throw new Error(error.message);
      const exp = Date.now() + URL_TTL_S * 1000;
      for (const row of data ?? []) if (row.path && row.signedUrl) urls.set(row.path, { url: row.signedUrl, exp });
      for (const id of imageIds) {
        const p = paths.get(id);
        const u = p ? cached(p) : null;
        if (u) out[id] = u;
      }
    }
    return out;
  }

  async function signedUrl(imageId: string) {
    const url = (await signedUrls([imageId]))[imageId];
    if (!url) throw new Error("Could not get a link for this image. It may have been deleted.");
    return url;
  }

  return {
    async loadSession(datasetId) {
      const sbc = db();
      const [ds, cls, admin] = await Promise.all([
        sbc.from("datasets").select("name").eq("id", datasetId).maybeSingle(),
        sbc.from("classes").select("id, dataset_id, name, idx, color").eq("dataset_id", datasetId).order("idx"),
        sbc.rpc("is_admin"),
      ]);
      if (ds.error) throw new Error(ds.error.message);
      if (!ds.data) throw new Error("This dataset does not exist, or your account cannot see it.");
      if (cls.error) throw new Error(cls.error.message);

      const images: ImageRecord[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sbc
          .from("images")
          .select("id, dataset_id, name, number, storage_path, width, height, bytes, status, labeled_by, labeled_at, created_at")
          .eq("dataset_id", datasetId)
          .order("number")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const r of data) {
          paths.set(r.id, r.storage_path);
          images.push({
            id: r.id,
            datasetId: r.dataset_id,
            name: r.name,
            number: r.number,
            storagePath: r.storage_path,
            width: r.width,
            height: r.height,
            bytes: r.bytes,
            status: r.status as ImageStatus,
            labeledBy: r.labeled_by,
            labeledAt: r.labeled_at,
            createdAt: r.created_at,
          });
        }
        if (data.length < PAGE) break;
      }

      return {
        datasetName: ds.data.name as string,
        isAdmin: admin.data === true,
        classes: cls.data.map((c): ClassDef => ({ id: c.id, datasetId: c.dataset_id, name: c.name, index: c.idx, color: c.color })),
        images,
      };
    },

    async loadImage(imageId) {
      const [url, ann] = await Promise.all([
        signedUrl(imageId),
        db().from("annotations").select("id, class_id, x, y, w, h").eq("image_id", imageId).order("created_at").order("id"),
      ]);
      if (ann.error) throw new Error(ann.error.message);
      return {
        url,
        boxes: ann.data.map((a): DraftBox => ({ id: a.id, classId: a.class_id, x: a.x, y: a.y, w: a.w, h: a.h })),
      };
    },

    async saveBoxes(imageId, boxes) {
      const me = await userId();
      const rows = boxes.flatMap((b) => {
        const n = normalizeBox(b);
        return n ? [{ id: b.id, image_id: imageId, class_id: b.classId, created_by: me, ...n }] : [];
      });
      // Replace-all keeps retries idempotent. Not atomic: a failed insert is retried by autosave.
      const del = await db().from("annotations").delete().eq("image_id", imageId);
      if (del.error) throw new Error(del.error.message);
      if (rows.length) {
        const ins = await db().from("annotations").insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
    },

    async setImageStatus(imageId, status) {
      const me = await userId();
      const labeled = status === "done" || status === "skipped";
      const { error } = await db()
        .from("images")
        .update({ status, labeled_by: status === "unlabeled" ? null : me, labeled_at: labeled ? new Date().toISOString() : null })
        .eq("id", imageId);
      if (error) throw new Error(error.message);
    },

    thumbnailUrls: signedUrls,

    prefetchImage(imageId) {
      void signedUrl(imageId)
        .then((u) => {
          const img = new Image();
          img.decoding = "async";
          img.src = u;
        })
        .catch(() => {});
    },
  };
}
