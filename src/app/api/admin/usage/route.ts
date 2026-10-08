import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { FREE_TIER, type StorageUsage } from "@/lib/types";

/** GET -> ApiResult<StorageUsage> (admin only; storage_usage() RPC is admin-checked in SQL). */
export async function GET() {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const { data, error } = await ctx.supabase.rpc("storage_usage");
  if (error) return fail(500, "usage_failed", error.message);
  const u = data as { storageBytes: number; dbBytes: number; imageCount: number; boxCount: number };
  const usage: StorageUsage = {
    storageBytes: Number(u.storageBytes),
    storageLimitBytes: FREE_TIER.storageBytes,
    dbBytes: Number(u.dbBytes),
    dbLimitBytes: FREE_TIER.dbBytes,
    imageCount: Number(u.imageCount),
    boxCount: Number(u.boxCount),
  };
  return ok(usage);
}
