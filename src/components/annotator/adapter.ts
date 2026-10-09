import type { ClassDef, DraftBox, ImageRecord, ImageStatus } from "@/lib/types";

export interface AnnotatorSession {
  /** Display name of the dataset, shown in the workspace top bar. */
  datasetName: string;
  /** True when the signed-in user is an admin (drives "Back to admin" and upload links). */
  isAdmin: boolean;
  classes: ClassDef[];
  /** Ordered list of images in the dataset (by number). */
  images: ImageRecord[];
}

export interface LoadedImage {
  /** Signed or public URL the <img> can render. */
  url: string;
  boxes: DraftBox[];
}

/**
 * Data boundary for the annotator. The UI never talks to Supabase directly;
 * the label page injects an implementation (supabase-js in the app, in-memory for demos).
 * All box coordinates are normalized YOLO xywh (center x, center y, width, height), each in [0,1],
 * which is exactly what src/lib/yolo/convert.ts writes to the label .txt files.
 */
export interface AnnotatorAdapter {
  loadSession(datasetId: string): Promise<AnnotatorSession>;
  loadImage(imageId: string): Promise<LoadedImage>;
  /** Replace all boxes for the image. Must be idempotent (called with retries). */
  saveBoxes(imageId: string, boxes: DraftBox[]): Promise<void>;
  setImageStatus(imageId: string, status: ImageStatus): Promise<void>;
  /** Optional: URLs for small previews in the image list, keyed by image id. */
  thumbnailUrls?(imageIds: string[]): Promise<Record<string, string>>;
  /** Optional: warm caches for an image the user is likely to open next. */
  prefetchImage?(imageId: string): void;
}
