# Supabox backend notes

Step-by-step setup (env vars, running the migration, creating the first admin)
is in the root `README.md`. This file covers how auth and security work.

## Auth model

Same pattern as DannFlow:

- Sign-in is **email + password** (`supabase.auth.signInWithPassword`).
- Public sign-up is off. Accounts are created by an admin, either in the
  Supabase dashboard (Authentication → Users → Add user) or in-app at
  `/admin/users` (`POST /api/admin/users`, which uses the service role and
  creates the user pre-confirmed).
- Trigger `on_auth_user_created` on `auth.users` inserts a `public.profiles`
  row with `role = 'labeler'`. The migration also backfills profiles for users
  that existed before it ran.
- Promote to admin by setting `profiles.role = 'admin'` (Table Editor, SQL, or
  the "Make admin" button in `/admin/users`).

## Security model

- Every table has RLS.
  - `is_member()`: caller has a profile.
  - `is_admin()`: caller's profile has `role = 'admin'`.
- Users can edit their own profile but cannot change their own `role`
  (policy `profiles_update_self`). Only admins change roles.
- Labelers can only update `status`, `labeled_by` and `labeled_at` on images
  (trigger `guard_image_update`).
- Storage bucket `images` is private: members read, admins write.
- The service role key is used only in `src/lib/supabase/admin.ts`
  (`server-only`), always after an admin check.
- `src/proxy.ts` redirects signed-out users to `/login`, returns 401 for
  `/api/*`, and keeps non-admins out of `/admin`. Real authorization is RLS.

## Admin API

| Route | Purpose |
|---|---|
| `GET /api/admin/users` | list users (profiles + last sign-in) |
| `POST /api/admin/users` `{email, password, role?}` | create account |
| `PATCH /api/admin/users` `{id, role}` | change role |
| `DELETE /api/admin/users?id=` | delete account |
| `GET /api/admin/usage` | storage / DB usage vs free tier |
| `POST /api/admin/upload-urls` | allocate image numbers + signed upload URLs |
| `POST /api/datasets/[id]/reset` | clear a dataset after export |
| `GET /api/export/[datasetId]` | YOLO ZIP download |
