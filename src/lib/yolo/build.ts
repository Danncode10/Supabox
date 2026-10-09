import type { ClassDef, ImageRecord, ImageStatus } from "../types";
import { boxesToLabelText } from "./convert";
import { extOf, uniqueStems } from "./paths";
import { assignSplits, buildDataYaml, DEFAULT_RATIOS, type Split, type SplitRatios } from "./split";
import type { ZipEntry } from "./zip";

/** Data access the export needs. Implemented with server Supabase helpers by the route. */
export interface ExportSource {
  listClasses(datasetId: string): Promise<ClassDef[]>;
  /** All images for the dataset (any status). */
  listImages(datasetId: string): Promise<ImageRecord[]>;
  /** Boxes grouped by image id (center-format normalized). */
  listBoxes(
    imageIds: string[],
  ): Promise<Map<string, Array<{ x: number; y: number; w: number; h: number; classId: string }>>>;
  downloadImage(storagePath: string): Promise<Uint8Array>;
}

/**
 * Which images go into the archive.
 * - "done": only images a labeler finished (default; in_progress may have an incomplete box set).
 * - "all":  done + in_progress + unlabeled. Images with no boxes become YOLO background images (empty .txt).
 * `skipped` images are never exported: a labeler rejected them.
 */
export type ExportStatusFilter = "done" | "all";

export const EXPORT_STATUSES: Record<ExportStatusFilter, readonly ImageStatus[]> = {
  done: ["done"],
  all: ["done", "in_progress", "unlabeled"],
};

export interface BuildOptions {
  ratios?: SplitRatios;
  seed?: number;
  status?: ExportStatusFilter;
}

export interface ExportPlan {
  entries: AsyncGenerator<ZipEntry>;
  imageCount: number;
  /** Total number of label lines (boxes) written. */
  labelCount: number;
  splitCounts: Record<Split, number>;
}

/**
 * Plan a YOLO detection archive:
 *   images/{train,val[,test]}/<name>.<ext>, labels/{same}/<name>.txt, data.yaml
 * Class ids are re-numbered densely 0..N-1 in `classes.idx` order so labels always match `names`.
 */
export async function planExport(
  datasetId: string,
  src: ExportSource,
  opts: BuildOptions = {},
): Promise<ExportPlan> {
  const [classes, allImages] = await Promise.all([src.listClasses(datasetId), src.listImages(datasetId)]);
  const sortedClasses = [...classes].sort((a, b) => a.index - b.index);
  const classIndexById = new Map(sortedClasses.map((c, dense) => [c.id, dense]));
  const keep = new Set<ImageStatus>(EXPORT_STATUSES[opts.status ?? "done"]);
  const images = allImages.filter((i) => keep.has(i.status));
  const boxesByImage = images.length ? await src.listBoxes(images.map((i) => i.id)) : new Map();
  const ratios = opts.ratios ?? DEFAULT_RATIOS;
  const splits = assignSplits(images, ratios, opts.seed);
  const stems = uniqueStems([...images].sort((a, b) => a.number - b.number), (i) => i.name);

  const splitCounts: Record<Split, number> = { train: 0, val: 0, test: 0 };
  for (const s of splits.values()) splitCounts[s]++;

  const texts = new Map<string, string>();
  let labelCount = 0;
  for (const img of images) {
    const text = boxesToLabelText(boxesByImage.get(img.id) ?? [], classIndexById);
    texts.set(img.id, text);
    if (text) labelCount += text.split("\n").length - 1;
  }

  const yaml = buildDataYaml(
    sortedClasses.map((c) => c.name),
    { test: splitCounts.test > 0, val: splitCounts.val > 0 ? "val" : "train" },
  );

  const enc = new TextEncoder();
  const ordered = [...images].sort((a, b) => a.number - b.number);
  async function* gen(): AsyncGenerator<ZipEntry> {
    yield { path: "data.yaml", data: enc.encode(yaml) };
    for (const img of ordered) {
      const split = splits.get(img)!;
      const stem = stems.get(img)!;
      yield { path: `images/${split}/${stem}.${extOf(img.storagePath)}`, data: () => src.downloadImage(img.storagePath) };
      yield { path: `labels/${split}/${stem}.txt`, data: enc.encode(texts.get(img.id) ?? "") };
    }
  }
  return { entries: gen(), imageCount: images.length, labelCount, splitCounts };
}
