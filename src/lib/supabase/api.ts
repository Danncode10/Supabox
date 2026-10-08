import "server-only";
import type { ApiResult, Role } from "@/lib/types";
import { createClient } from "./server";

type Status = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 422 | 500;

export function ok<T>(data: T, status: Status = 200) {
  return Response.json({ data, error: null } satisfies ApiResult<T>, { status });
}

export function fail(status: Status, code: string, message: string) {
  return Response.json({ data: null, error: { code, message } } satisfies ApiResult<never>, { status });
}

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  role: Role;
};

/** Returns the signed-in allowlisted user, or a Response (401/403) to return directly. */
export async function requireUser(): Promise<AuthContext | Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthenticated", "Sign in required");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data: member } = await supabase.rpc("is_member");
  if (!profile || !member) return fail(403, "forbidden", "Account is not allowed");
  return { supabase, userId: user.id, email: user.email ?? "", role: profile.role as Role };
}

export async function requireAdmin(): Promise<AuthContext | Response> {
  const ctx = await requireUser();
  if (ctx instanceof Response) return ctx;
  if (ctx.role !== "admin") return fail(403, "forbidden", "Admin only");
  return ctx;
}
