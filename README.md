# Supabox

Label images with bounding boxes from your phone, store everything in Supabase,
and export a dataset that YOLOv8 (and other Ultralytics YOLO versions) can train
on directly.

Built so classmates without a laptop can help label: the annotator is
touch-first (draw, move and resize boxes with one finger, pinch to zoom).

- **Labelers** sign in, pick a dataset, and label images.
- **Admins** upload images, manage classes, create user accounts, watch the
  free-tier storage meter, export YOLO ZIPs, and reset a dataset after export.

Stack: Next.js 16 (App Router, Cache Components), React 19, Tailwind 4,
Supabase (Postgres + Auth + Storage).

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Fill in `.env.local`

Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API → Project URL** (or the green **Connect** button at the top). Looks like `https://<ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API Keys**. Use the **Publishable key** (`sb_publishable_...`), or the legacy **anon public** key from the "Legacy API keys" tab. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API Keys**. Use a **Secret key** (`sb_secret_...`), or the legacy **service_role** key. **Server-only.** Never put it in a `NEXT_PUBLIC_` variable or commit it. |

`.env*` files are gitignored. On Vercel, add the same three variables under
**Project → Settings → Environment Variables**.

### 3. Create the database (run the migration)

The schema lives in `supabase/migrations/`. Nothing is applied automatically;
pick one way:

**Option A: SQL editor (easiest)**
1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole contents of
   `supabase/migrations/20261008000000_init_supabox.sql` and click **Run**.

**Option B: Supabase CLI (`npm run db:migrate`)**
```bash
npx supabase login            # once; opens the browser
npm run db:link               # once; pick your project (or: npx supabase link --project-ref <ref>)
npm run db:migrate            # applies everything in supabase/migrations/
```
`<ref>` is the id in your project URL. The CLI asks for your **database
password** (the one you set when creating the project; reset it under
**Project Settings → Database** if you forgot it).

After it runs you should see these tables under **Table Editor**: `profiles`,
`datasets`, `classes`, `images`, `annotations`, plus a private **Storage**
bucket called `images`.

### 4. Auth settings

Dashboard → **Authentication → Sign In / Providers**:
- **Email** provider: enabled.
- **Allow new users to sign up**: turn **off**. Only admins create accounts.
- **Confirm email**: can stay on. Users created by an admin are already confirmed.

### 5. Create users and make yourself admin

1. Dashboard → **Authentication → Users → Add user → Create new user**.
   Enter an email + password and tick **Auto Confirm User**.
2. A row appears automatically in **Table Editor → profiles** with
   `role = labeler` (a database trigger creates it; users that existed before
   you ran the migration are backfilled too).
3. Change that row's `role` cell to **`admin`** and save. Or run in the SQL
   editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@gmail.com';
   ```
4. Sign in at `/login` with that email + password. You now see **Admin**.

After the first admin exists, add classmates from **Admin → Users** in the app
(email, temporary password, role), so you don't need the Supabase dashboard
again.

### 6. Run

```bash
npm run dev     # http://localhost:3000
```

`npm run dev` listens on all interfaces, so from a phone on the same Wi-Fi open `http://<your-computer-ip>:3000`.

---

## Workflow

1. **Admin → New dataset**, then add classes (e.g. `citrus`, `leaf`).
2. Set the naming: prefix + start number (`image_2103`, `image_2104`, ...).
3. Upload images (optionally compressed to 1280px to save free-tier storage).
4. Labelers open the dataset and label; boxes autosave.
5. **Export** downloads a ZIP:
   ```text
   images/{train,val}/image_2103.jpg
   labels/{train,val}/image_2103.txt   # class cx cy w h (normalized 0-1)
   data.yaml
   ```
   Train with `yolo detect train data=data.yaml model=yolov8n.pt`.
6. **Reset** (after export) clears images + boxes so you can upload the next
   batch within the free 1 GB storage.

## Scripts

```bash
npm run dev          # dev server on 0.0.0.0:3000 (open from your phone on the same Wi-Fi)
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test:yolo    # YOLO export unit tests

npm run db:link      # link the repo to your Supabase project (once)
npm run db:migrate   # push supabase/migrations/ to the linked project
npm run db:generate  # name a new migration from schema changes: npm run db:generate -- my_change
npm run db:pull      # pull remote schema into a migration
npm run db:compare   # diff local migrations against the linked project
npm run db:types     # generate src/types/supabase.ts from the linked project
```

## Docs

- `docs/SPEC.md`: product spec and data model
- `docs/SETUP.md`: security model details
- `docs/UI-KIT.md`: design tokens and components
- `docs/DATABOX-ANALYSIS.md`: what was kept from the old Databox repo

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) to get set up and send changes. Supabox is released under the [MIT License](LICENSE).
