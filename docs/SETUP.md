# Supabox backend setup

## 1. Create a Supabase project
Create a project at supabase.com (free tier). Copy the project URL, anon key and service role key into `.env.local` (see `.env.example`; names only, never commit values). Set the same variables in Vercel. The service role key is server-only.

## 2. Auth settings (Dashboard > Authentication)
- Providers: enable Email. Disable "Allow new users to sign up" only if you prefer; the allowlist trigger already blocks non-listed emails.
- URL Configuration: Site URL = your Vercel URL; add `http://localhost:3000/auth/callback` and `<vercel-url>/auth/callback` to Redirect URLs.
- Email template (Magic Link): include `{{ .Token }}` so phones can use the 6-digit code.

## 3. Run migrations (admin, manually)
```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```
Or paste `supabase/migrations/*.sql` into the SQL editor in order. Migrations are never applied automatically.

## 4. Bootstrap the first admin
Run once in the SQL editor (see `supabase/seed.sql`):
```
insert into public.allowed_emails (email, role) values ('you@example.com', 'admin');
```
Sign in at `/login` with that email; a profile with role admin is created. Further users are added at `/admin/users` (`/api/admin/users`).

## Security model
- Every table has RLS; helpers `is_member()` and `is_admin()` require a profile that is still on the allowlist.
- A trigger on `auth.users` rejects sign-ups for emails not in `allowed_emails`.
- Storage bucket `images` is private; members read, admins write.
- Service role is used only in `src/lib/supabase/admin.ts` (server-only) after an admin check.
