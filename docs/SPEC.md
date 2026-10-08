# Supabox Product Spec

## 1. Goals
- Classmates label images **from their phones** (no laptop needed).
- Draw bounding boxes, assign classes, export **YOLOv8-compatible** datasets (works for any YOLO txt-format version).
- Data lives in Supabase (Auth + Postgres + Storage), deployable on Vercel (Next.js 16 App Router).
- Admin role: upload images, see free-tier usage, invite users by email, export and reset.

Non-goals (v1): polygons, keypoints, video, AI pre-labeling, billing, public signup.

## 2. Roles
| Role | Can |
|---|---|
| admin | everything labeler can; create datasets/classes; upload/delete images; set naming; manage allowed emails and roles; view storage usage; export; reset dataset |
| labeler | sign in with an account created by an admin; open a dataset; label, edit, delete own/any boxes; mark image done/skipped |

Sign-in: Supabase email + password. Public sign-up is disabled; admins create accounts (dashboard or `/admin/users`). A trigger creates a `profiles` row with role `labeler` for every auth user; promote by setting `profiles.role = 'admin'`. Next.js 16 uses `proxy.ts` (renamed from middleware) for session refresh and route guards; real authorization is enforced by RLS.

## 3. Flows
1. **Admin setup**: sign in -> create dataset (name, prefix, start number, classes) -> bulk upload images -> invite emails.
2. **Label (phone)**: sign in -> dataset list -> "Next unlabeled" -> canvas editor -> draw/adjust boxes -> Done (auto advances) -> repeat.
3. **Export**: admin taps Export -> server streams ZIP in YOLOv8 layout (section 7). Dataset status becomes `exported`.
4. **Reset after export**: admin confirms (type dataset name; warning that export must be downloaded first) -> deletes images, annotations (and optionally classes), clears storage objects, keeps dataset/prefix, and lets admin set a new start number. Reset is blocked unless the dataset was exported (`last_exported_at` not null) or admin overrides explicitly.

## 4. Image naming
Dataset has `name_prefix` (default `image`), `next_number`, `number_pad`. On upload, each image gets `number = next_number++` and `name = {prefix}_{number}` (zero-padded if configured). Start 2103 -> `image_2103`, `image_2104`. Allocation happens in a Postgres function inside one transaction to avoid collisions. Storage path: `{dataset_id}/{name}.{ext}`. Exported label file shares the stem: `image_2103.txt`.

## 5. Mobile UX principles
- Touch first: 48px minimum targets, bottom action bar within thumb reach, no hover dependence.
- Canvas uses Pointer Events; one finger draws/drags, two-finger pinch zoom + pan; handles are enlarged (>=24px hit area) with a magnifier-free "nudge" mode.
- Draw modes: drag a box, or tap two corners. Tap box to select; bottom sheet picks class; undo/redo always visible.
- Autosave on every change (debounced), optimistic UI, offline-tolerant queue for flaky mobile data; no data loss on tab close.
- Images served resized for editing (max ~1280px side via Supabase transform or client downscale at upload); boxes are normalized so resolution is irrelevant.
- Progress counter, next/prev swipe, skip button. Prevent pull-to-refresh and browser zoom inside canvas (`touch-action: none`).
- Layout mobile-first (360px), enhances for desktop. Light and dark themes.

## 6. Supabase free-tier constraints
- Storage 1 GB, Database 500 MB, ~5 GB egress/month, 50k MAU.
- Upload pipeline compresses client-side: resize long side to <= 1280 px, JPEG quality ~0.8 (target ~150-300 KB/img => ~3-6k images/GB). Original not kept.
- Admin dashboard shows `StorageUsage` (bytes from `storage.objects` sum and `pg_database_size`) with warning at 80% and upload blocked at 95%.
- Annotation rows are tiny (~100 B/box); DB is not the bottleneck. No base64 images in DB ever.
- Reset-after-export is the intended way to reclaim space.

## 7. YOLOv8 export format
```
{dataset-name}.zip
  images/train/image_2103.jpg ...
  images/val/...
  labels/train/image_2103.txt
  labels/val/...
  data.yaml
```
- Label line: `<class_index> <x_center> <y_center> <width> <height>`, 6 decimals, normalized [0,1], clamped. Images with zero boxes get an empty `.txt` (valid background images) if status `done`; `unlabeled` and `skipped` are excluded.
- Split: train/val (default 80/20, seeded shuffle by image number for reproducibility; optional test).
- `data.yaml`: `path: .`, `train: images/train`, `val: images/val`, `nc: N`, `names: [..]` ordered by class `index`.
- Class `index` is contiguous 0..N-1; deleting a class requires reindex/reassign (admin warning).
- Images are exported from storage as stored (resized). Since boxes are normalized, YOLO labels remain correct.

## 8. Data model (Postgres, RLS on every table)
```
profiles(id uuid pk -> auth.users, email text unique, display_name text, role text check in (admin,labeler), created_at)
datasets(id uuid pk, name text, name_prefix text default 'image', next_number int default 1, number_pad int default 0,
         status text default 'active', created_by uuid, created_at, last_exported_at)
classes(id uuid pk, dataset_id fk cascade, name text, idx int, color text, unique(dataset_id, idx), unique(dataset_id, name))
images(id uuid pk, dataset_id fk cascade, name text, number int, storage_path text, width int, height int, bytes int,
       status text default 'unlabeled', labeled_by uuid, labeled_at, created_at, unique(dataset_id, name))
annotations(id uuid pk, image_id fk cascade, class_id fk, x real, y real, w real, h real,
            created_by uuid, created_at, check (x,y,w,h between 0 and 1 and w>0 and h>0))
```
Indexes: images(dataset_id,status), annotations(image_id).
RLS: authenticated users in `profiles` can select datasets/classes/images/annotations; labelers can insert/update/delete annotations and update `images.status`; only admins write datasets, classes, images (insert/delete), profiles.role. Helper `is_admin()` security-definer function. SQL functions (security definer, admin-checked): `allocate_image_numbers(dataset, n)`, `storage_usage()`, `reset_dataset(dataset)`.

### Storage layout
Private bucket `images`. Path `{dataset_id}/{name}.{ext}`. Storage RLS: authenticated read; admin-only insert/delete. Client uses signed URLs (short TTL) or Supabase image transforms.

## 9. Route map and ownership
Task owners are provisional (T1 architect defines; others assigned by lead).

| Route | Purpose | Owner |
|---|---|---|
| `/login` | email + password | auth task |
| `/auth/callback` (route handler) | exchange code | auth task |
| `/` | dataset list (labeler) / dashboard (admin) | UI task |
| `/d/[datasetId]` | dataset overview, progress, image grid | UI task |
| `/d/[datasetId]/label/[imageId]` | mobile annotation editor | editor task |
| `/admin` | usage meter, users, datasets | admin task |
| `/admin/users` | user accounts + roles | admin task |
| `/admin/d/[datasetId]` | upload, classes, naming, export, reset | admin task |
| `/api/datasets/[id]/export` GET | stream YOLO ZIP | export task |
| `/api/datasets/[id]/reset` POST | reset after export | admin task |
| `/api/admin/usage` GET | `StorageUsage` | admin task |
| `/api/admin/users` GET/POST/PATCH/DELETE | create/list/role/delete users | admin task |
| `proxy.ts` | session refresh, guards | auth task |
| `supabase/migrations/*` | schema, RLS, functions | backend task |
| `src/lib/types.ts`, `docs/` | architect (T1) | T1 |

API conventions: JSON `ApiResult<T>`; 401 unauthenticated, 403 wrong role, 404, 409 conflict, 422 validation; plural kebab-case resources. Most CRUD goes direct through supabase-js + RLS; Route Handlers only for export, reset, usage and admin user management (service role, server-only).
In Next.js 16 `params`/`searchParams` are Promises: `await params`.

## 10. Open questions
1. ~~Auth method~~ Decided: email + password, accounts created by admin.
2. Resize at upload (lossy, saves storage) vs keep originals (hits 1 GB fast). Spec assumes resize.
3. Concurrent labeling: lock an image per labeler, or last-write-wins? Spec assumes last-write-wins plus `labeled_by`.
4. Train/val split fixed at export time (assumed) or stored per image?
5. Does reset also delete classes? Assumed: option, default keep classes.
6. Single admin or several? Assumed multiple; first admin is promoted by editing `profiles.role` (see README).
7. Is a Supabase project already provisioned (URL, keys)? Needed for env vars; none are stored in repo.
