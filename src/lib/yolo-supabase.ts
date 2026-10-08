import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET, type ClassDef, type ImageRecord, type ImageStatus, type Role } from "@/lib/types";
import { registerExportBackend, type ExportBackend } from "@/lib/yolo/backend";

const PAGE = 1000;
const IN_CHUNK = 100;

async function createSupabaseExportBackend(): Promise<ExportBackend> {
  const supabase = await createClient(); // RLS applies to reads
  const admin = createAdminClient(); // only after the route verified admin; used for streaming work

  return {
    async getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!profile) return null;
      return { id: user.id, role: profile.role as Role };
    },

    async getDatasetName(datasetId) {
      const { data } = await supabase.from("datasets").select("name").eq("id", datasetId).maybeSingle();
      return data?.name ?? null;
    },

    async markExported(datasetId) {
      const { error } = await admin
        .from("datasets")
        .update({ last_exported_at: new Date().toISOString(), status: "exported" })
        .eq("id", datasetId);
      if (error) throw new Error(error.message);
    },

    async listClasses(datasetId) {
      const { data, error } = await supabase
        .from("classes").select("id, dataset_id, name, idx, color").eq("dataset_id", datasetId).order("idx");
      if (error) throw new Error(error.message);
      return data.map((c): ClassDef => ({ id: c.id, datasetId: c.dataset_id, name: c.name, index: c.idx, color: c.color }));
    },

    async listImages(datasetId) {
      const out: ImageRecord[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("images").select("*").eq("dataset_id", datasetId).order("number").range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const r of data) {
          out.push({
            id: r.id, datasetId: r.dataset_id, name: r.name, number: r.number, storagePath: r.storage_path,
            width: r.width, height: r.height, bytes: r.bytes, status: r.status as ImageStatus,
            labeledBy: r.labeled_by, labeledAt: r.labeled_at, createdAt: r.created_at,
          });
        }
        if (data.length < PAGE) break;
      }
      return out;
    },

    async listBoxes(imageIds) {
      const map = new Map<string, Array<{ x: number; y: number; w: number; h: number; classId: string }>>();
      for (let i = 0; i < imageIds.length; i += IN_CHUNK) {
        const ids = imageIds.slice(i, i + IN_CHUNK);
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("annotations").select("image_id, class_id, x, y, w, h").in("image_id", ids)
            .order("created_at").order("id").range(from, from + PAGE - 1);
          if (error) throw new Error(error.message);
          for (const a of data) {
            const list = map.get(a.image_id) ?? [];
            list.push({ x: a.x, y: a.y, w: a.w, h: a.h, classId: a.class_id });
            map.set(a.image_id, list);
          }
          if (data.length < PAGE) break;
        }
      }
      return map;
    },

    async downloadImage(storagePath) {
      const { data, error } = await admin.storage.from(IMAGE_BUCKET).download(storagePath);
      if (error || !data) throw new Error(error?.message ?? `missing object ${storagePath}`);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

registerExportBackend(createSupabaseExportBackend);
