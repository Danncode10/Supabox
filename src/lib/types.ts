/**
 * Shared domain types for Supabox. Mirrors the Postgres schema in docs/SPEC.md.
 * Coordinates are normalized YOLO xywh (center x, center y, width, height), each in [0,1].
 */

export type Role = "admin" | "labeler";

export type ISODateString = string;

export interface Profile {
  id: string; // = auth.users.id
  email: string;
  displayName: string | null;
  role: Role;
  createdAt: ISODateString;
}

/** A user account as shown on /admin/users. */
export interface ManagedUser {
  id: string;
  email: string;
  role: Role;
  createdAt: ISODateString;
  lastSignInAt: ISODateString | null;
}

export type DatasetStatus = "active" | "exported" | "archived";

export interface Dataset {
  id: string;
  name: string;
  /** Image filename prefix, e.g. "image" */
  namePrefix: string;
  /** Next number to assign; first image with start 2103 becomes image_2103 */
  nextNumber: number;
  /** Zero-pad width for numbers (0 = none) */
  numberPad: number;
  status: DatasetStatus;
  createdBy: string;
  createdAt: ISODateString;
  lastExportedAt: ISODateString | null;
}

export interface ClassDef {
  id: string;
  datasetId: string;
  name: string;
  /** Stable 0-based YOLO class index; contiguous per dataset */
  index: number;
  /** Hex color e.g. "#ff5a5f" */
  color: string;
}

export type ImageStatus = "unlabeled" | "in_progress" | "done" | "skipped";

export interface ImageRecord {
  id: string;
  datasetId: string;
  /** Final exported name without extension, e.g. "image_2103" */
  name: string;
  /** Number portion used to build name */
  number: number;
  /** Path inside the storage bucket, e.g. "<datasetId>/image_2103.jpg" */
  storagePath: string;
  width: number;
  height: number;
  bytes: number;
  status: ImageStatus;
  labeledBy: string | null;
  labeledAt: ISODateString | null;
  createdAt: ISODateString;
}

/** Normalized YOLO box. All values in [0,1]. */
export interface BoxXYWH {
  x: number; // center x
  y: number; // center y
  w: number;
  h: number;
}

export interface Box extends BoxXYWH {
  id: string;
  imageId: string;
  classId: string;
  createdBy: string | null;
  createdAt: ISODateString;
}

/** Editor-side draft box (client state before persisting). */
export interface DraftBox extends BoxXYWH {
  id: string; // client uuid
  classId: string;
}

export interface StorageUsage {
  /** Bytes used in the images bucket */
  storageBytes: number;
  storageLimitBytes: number; // 1 GiB on free tier
  /** Bytes used by the Postgres database */
  dbBytes: number;
  dbLimitBytes: number; // 500 MiB on free tier
  imageCount: number;
  boxCount: number;
}

export interface DatasetProgress {
  datasetId: string;
  total: number;
  done: number;
  inProgress: number;
  skipped: number;
  unlabeled: number;
  boxes: number;
}

export interface ExportResult {
  datasetId: string;
  imageCount: number;
  labelCount: number;
  zipBytes: number;
}

/** Uniform API envelope for Route Handlers. */
export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

export const FREE_TIER = {
  storageBytes: 1024 * 1024 * 1024,
  dbBytes: 500 * 1024 * 1024,
} as const;

export const IMAGE_BUCKET = "images";
