import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import type { ManagedUser, Role } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const isRole = (r: unknown): r is Role => r === "admin" || r === "labeler";

/** GET -> ApiResult<ManagedUser[]> */
export async function GET() {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const { data: profiles, error } = await ctx.supabase
    .from("profiles").select("id, email, role, created_at").order("created_at");
  if (error) return fail(500, "list_failed", error.message);

  // Last sign-in lives in auth.users, which only the service role can read.
  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const lastSignIn = new Map((authList?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

  return ok(
    profiles.map((p) => ({
      id: p.id, email: p.email ?? "", role: p.role as Role, createdAt: p.created_at,
      lastSignInAt: lastSignIn.get(p.id) ?? null,
    })) satisfies ManagedUser[],
  );
}

/** POST { email, password, role? } -> create an account (email pre-confirmed). */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role ?? "labeler";
  if (!EMAIL_RE.test(email)) return fail(422, "invalid_email", "A valid email is required");
  if (password.length < MIN_PASSWORD) return fail(422, "invalid_password", `Password must be at least ${MIN_PASSWORD} characters`);
  if (!isRole(role)) return fail(422, "invalid_role", "role must be admin or labeler");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return fail(exists ? 409 : 500, exists ? "user_exists" : "create_failed", error.message);
  }
  // The on_auth_user_created trigger made a 'labeler' profile; promote if asked.
  if (role === "admin") {
    const { error: roleErr } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (roleErr) return fail(500, "role_failed", roleErr.message);
  }
  return ok({ id: data.user.id, email, role }, 201);
}

/** PATCH { id, role } -> change a user's role. */
export async function PATCH(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const role = body?.role;
  if (!id) return fail(422, "invalid_id", "id is required");
  if (!isRole(role)) return fail(422, "invalid_role", "role must be admin or labeler");
  if (id === ctx.userId && role !== "admin") return fail(409, "self_demote", "You cannot remove your own admin role");

  const { error } = await ctx.supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return fail(500, "update_failed", error.message);
  return ok({ id, role });
}

/** DELETE ?id=... -> delete the auth user (profile cascades). */
export async function DELETE(request: Request) {
  const ctx = await requireAdmin();
  if (ctx instanceof Response) return ctx;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return fail(422, "invalid_id", "id query param required");
  if (id === ctx.userId) return fail(409, "self_delete", "You cannot remove yourself");

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return fail(500, "delete_user_failed", error.message);
  return ok({ id });
}
