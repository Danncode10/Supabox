import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import type { AllowedEmail, Role } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRole = (r: unknown): r is Role => r === "admin" || r === "labeler";

/** GET -> ApiResult<(AllowedEmail & { signedUp: boolean })[]> */
export async function GET() {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const { data, error } = await ctx.supabase
    .from("allowed_emails").select("email, role, added_by, created_at").order("created_at");
  if (error) return fail(500, "list_failed", error.message);
  const { data: profiles } = await ctx.supabase.from("profiles").select("email");
  const signed = new Set((profiles ?? []).map((p) => p.email));
  return ok(
    data.map((r) => ({
      email: r.email, role: r.role as Role, addedBy: r.added_by, createdAt: r.created_at,
      signedUp: signed.has(r.email),
    })) satisfies (AllowedEmail & { signedUp: boolean })[],
  );
}

/** POST { email, role? } -> add (or update role of) an allowlisted email. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role ?? "labeler";
  if (!EMAIL_RE.test(email)) return fail(422, "invalid_email", "A valid email is required");
  if (!isRole(role)) return fail(422, "invalid_role", "role must be admin or labeler");

  const { data: existing } = await ctx.supabase.from("allowed_emails").select("email").eq("email", email).maybeSingle();
  if (existing) {
    if (email === ctx.email.toLowerCase() && role !== "admin") {
      return fail(409, "self_demote", "You cannot remove your own admin role");
    }
    const { error } = await ctx.supabase.from("allowed_emails").update({ role }).eq("email", email);
    if (error) return fail(500, "update_failed", error.message);
    return ok({ email, role }, 200);
  }
  const { error } = await ctx.supabase.from("allowed_emails").insert({ email, role, added_by: ctx.userId });
  if (error) return fail(500, "insert_failed", error.message);
  return ok({ email, role }, 201);
}

/** DELETE ?email=... -> remove from allowlist and delete the auth user (service role). */
export async function DELETE(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) return fail(422, "invalid_email", "email query param required");
  if (email === ctx.email.toLowerCase()) return fail(409, "self_delete", "You cannot remove yourself");

  const { error } = await ctx.supabase.from("allowed_emails").delete().eq("email", email);
  if (error) return fail(500, "delete_failed", error.message);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (profile) {
    const { error: delErr } = await admin.auth.admin.deleteUser(profile.id);
    if (delErr) return fail(500, "delete_user_failed", delErr.message);
  }
  return ok({ email });
}
