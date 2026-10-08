import type { ClassDef, DraftBox, ImageRecord, ImageStatus } from "@/lib/types";

export interface AnnotatorSession {
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
 * the label page injects an implementation (in-memory demo today, supabase-js later).
 * All box coordinates are normalized YOLO xywh.
 */
export interface AnnotatorAdapter {
  loadSession(datasetId: string): Promise<AnnotatorSession>;
  loadImage(imageId: string): Promise<LoadedImage>;
  /** Replace all boxes for the image. Must be idempotent (called with retries). */
  saveBoxes(imageId: string, boxes: DraftBox[]): Promise<void>;
  setImageStatus(imageId: string, status: ImageStatus): Promise<void>;
}
