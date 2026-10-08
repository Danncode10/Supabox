import type { ClassDef, ImageRecord } from "../types";
import { boxesToLabelText } from "./convert";
import { assignSplits, buildDataYaml, DEFAULT_RATIOS, type SplitRatios } from "./split";
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

export interface BuildOptions {
  ratios?: SplitRatios;
  seed?: number;
}

export interface ExportPlan {
  entries: AsyncGenerator<ZipEntry>;
  imageCount: number;
  labelCount: number;
}

function extOf(storagePath: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(storagePath);
  return m ? m[1].toLowerCase() : "jpg";
}

/** Only `done` images are exported; unlabeled, in_progress and skipped are excluded. */
export async function planExport(
  datasetId: string,
  src: ExportSource,
  opts: BuildOptions = {},
): Promise<ExportPlan> {
  const [classes, allImages] = await Promise.all([src.listClasses(datasetId), src.listImages(datasetId)]);
  const sortedClasses = [...classes].sort((a, b) => a.index - b.index);
  const classIndexById = new Map(sortedClasses.map((c) => [c.id, c.index]));
  const images = allImages.filter((i) => i.status === "done");
  const boxesByImage = await src.listBoxes(images.map((i) => i.id));
  const ratios = opts.ratios ?? DEFAULT_RATIOS;
  const splits = assignSplits(images, ratios, opts.seed);

  const texts = new Map<string, string>();
  let labelCount = 0;
  for (const img of images) {
    const text = boxesToLabelText(boxesByImage.get(img.id) ?? [], classIndexById);
    texts.set(img.id, text);
    if (text) labelCount += text.split("\n").length - 1;
  }

  const enc = new TextEncoder();
  async function* gen(): AsyncGenerator<ZipEntry> {
    for (const img of images) {
      const split = splits.get(img)!;
      const ext = extOf(img.storagePath);
      yield { path: `images/${split}/${img.name}.${ext}`, data: () => src.downloadImage(img.storagePath) };
      yield { path: `labels/${split}/${img.name}.txt`, data: enc.encode(texts.get(img.id) ?? "") };
    }
    // names ordered by class index; contiguous 0..N-1 is expected (SPEC section 7).
    yield {
      path: "data.yaml",
      data: enc.encode(buildDataYaml(sortedClasses.map((c) => c.name), ratios.test > 0)),
    };
  }
  return { entries: gen(), imageCount: images.length, labelCount };
}
