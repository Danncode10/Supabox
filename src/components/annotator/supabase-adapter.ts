import { createClient } from "@/lib/supabase/client";
import { normalizeBox } from "@/lib/yolo/convert";
import type { ClassDef, DraftBox, ImageRecord, ImageStatus } from "@/lib/types";
import { signedUrls } from "@/lib/supabase/signed-urls";
import { thumbPathOf } from "@/lib/thumbs";
import type { AnnotatorAdapter } from "./adapter";

const PAGE = 1000;

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
  let uid: string | null = null;

  async function userId() {
    if (uid) return uid;
    const { data } = await db().auth.getSession();
    uid = data.session?.user.id ?? null;
    if (!uid) throw new Error("Your session expired. Sign in again to keep saving.");
    return uid;
  }

  async function signedUrl(imageId: string) {
    const p = paths.get(imageId);
    const url = p ? (await signedUrls([p]))[p] : null;
    if (!url) throw new Error("Could not get a link for this image. It may have been deleted.");
    return url;
  }

  /** Small thumbs/ previews, falling back to the full image for images uploaded before thumbnails existed. */
  async function thumbnailUrls(imageIds: string[]) {
    const ids = imageIds.filter((id) => paths.has(id));
    const thumbs = await signedUrls(ids.map((id) => thumbPathOf(paths.get(id)!)));
    const missing = ids.filter((id) => !thumbs[thumbPathOf(paths.get(id)!)]);
    const full = missing.length ? await signedUrls(missing.map((id) => paths.get(id)!)) : {};
    const out: Record<string, string> = {};
    for (const id of ids) {
      const p = paths.get(id)!;
      const u = thumbs[thumbPathOf(p)] ?? full[p];
      if (u) out[id] = u;
    }
    return out;
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

    thumbnailUrls,

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
