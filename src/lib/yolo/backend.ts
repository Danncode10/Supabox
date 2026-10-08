import type { Role } from "../types";
import type { ExportSource } from "./build";

/** Everything the export route needs from the server-side Supabase layer. */
export interface ExportBackend extends ExportSource {
  /** Resolve the signed-in user from the request cookies; null when unauthenticated. */
  getCurrentUser(): Promise<{ id: string; role: Role } | null>;
  /** Returns the dataset name, or null when it does not exist. */
  getDatasetName(datasetId: string): Promise<string | null>;
  /** Set datasets.last_exported_at = now() and status = 'exported'. */
  markExported(datasetId: string): Promise<void>;
}

type Factory = () => Promise<ExportBackend>;
let factory: Factory | null = null;

/**
 * Wire-up point. Until src/lib/supabase exists, the route answers 501.
 * Integration: call registerExportBackend(() => createSupabaseExportBackend()) from a server module,
 * or replace getExportBackend with a direct implementation built on the server Supabase client.
 */
export function registerExportBackend(f: Factory): void {
  factory = f;
}

export async function getExportBackend(): Promise<ExportBackend | null> {
  return factory ? factory() : null;
}
