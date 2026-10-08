-- Supabox initial schema: tables, indexes, RLS, helper functions, storage.
-- Do not apply automatically; run via `supabase db push` (see docs/SETUP.md).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table public.allowed_emails (
  email      text primary key check (email = lower(email)),
  role       text not null default 'labeler' check (role in ('admin','labeler')),
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique check (email = lower(email)),
  display_name text,
  role         text not null default 'labeler' check (role in ('admin','labeler')),
  created_at   timestamptz not null default now()
);

create table public.datasets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  name_prefix      text not null default 'image' check (name_prefix ~ '^[A-Za-z0-9_-]+$'),
  next_number      int  not null default 1 check (next_number >= 0),
  number_pad       int  not null default 0 check (number_pad between 0 and 12),
  status           text not null default 'active' check (status in ('active','exported','archived')),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  last_exported_at timestamptz
);

create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  idx        int  not null check (idx >= 0),
  color      text not null default '#ff5a5f' check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique (dataset_id, idx) deferrable initially immediate,
  unique (dataset_id, name)
);

create table public.images (
  id           uuid primary key default gen_random_uuid(),
  dataset_id   uuid not null references public.datasets(id) on delete cascade,
  name         text not null,
  number       int  not null,
  storage_path text not null,
  width        int  not null check (width > 0),
  height       int  not null check (height > 0),
  bytes        int  not null check (bytes >= 0),
  status       text not null default 'unlabeled' check (status in ('unlabeled','in_progress','done','skipped')),
  labeled_by   uuid references auth.users(id) on delete set null,
  labeled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (dataset_id, name)
);

create table public.annotations (
  id         uuid primary key default gen_random_uuid(),
  image_id   uuid not null references public.images(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete restrict,
  x real not null, y real not null, w real not null, h real not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (x between 0 and 1 and y between 0 and 1 and w > 0 and w <= 1 and h > 0 and h <= 1)
);

create index images_dataset_status_idx on public.images (dataset_id, status);
create index images_dataset_number_idx on public.images (dataset_id, number);
create index annotations_image_idx     on public.annotations (image_id);
create index annotations_class_idx     on public.annotations (class_id);
create index classes_dataset_idx       on public.classes (dataset_id);

-- ---------------------------------------------------------------- helpers
-- Caller has a profile AND is still on the allowlist.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = (select auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = (select auth.uid()) and p.role = 'admin' and a.role = 'admin'
  );
$$;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.is_member(), public.is_admin(), public.current_user_role() from public, anon;
grant execute on function public.is_member(), public.is_admin(), public.current_user_role() to authenticated;

-- ------------------------------------------------ allowlist enforcement
-- Block account creation for emails not on the allowlist.
create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'Email is not allowed to sign in' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger enforce_allowlist_before_insert
  before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- Create profile with allowlist role on first sign-in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, role)
  select new.id, lower(new.email), a.role
  from public.allowed_emails a where a.email = lower(new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.enforce_allowlist(), public.handle_new_user() from public, anon, authenticated;

-- Labelers may only change status / labeled_by / labeled_at on images.
create or replace function public.guard_image_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if (new.id, new.dataset_id, new.name, new.number, new.storage_path, new.width, new.height, new.bytes)
       is distinct from
       (old.id, old.dataset_id, old.name, old.number, old.storage_path, old.width, old.height, old.bytes) then
      raise exception 'Only admins can modify image metadata';
    end if;
  end if;
  return new;
end $$;

create trigger guard_image_update_trg
  before update on public.images
  for each row execute function public.guard_image_update();

-- Keep profile role in sync when admin changes allowlist role.
create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = new.role where email = new.email;
  return new;
end $$;

create trigger sync_profile_role_trg
  after update of role on public.allowed_emails
  for each row execute function public.sync_profile_role();

-- ------------------------------------------------------------- RLS: tables
alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.datasets       enable row level security;
alter table public.classes        enable row level security;
alter table public.images         enable row level security;
alter table public.annotations    enable row level security;

-- allowed_emails: admin only
create policy allowed_emails_admin_all on public.allowed_emails
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles: members read all (labeled_by display); self may edit display_name only; admin edits all
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select public.is_member()) or id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select public.current_user_role()));
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- datasets / classes: members read, admin writes
create policy datasets_select on public.datasets for select to authenticated using ((select public.is_member()));
create policy datasets_admin_insert on public.datasets for insert to authenticated with check ((select public.is_admin()));
create policy datasets_admin_update on public.datasets for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy datasets_admin_delete on public.datasets for delete to authenticated using ((select public.is_admin()));

create policy classes_select on public.classes for select to authenticated using ((select public.is_member()));
create policy classes_admin_insert on public.classes for insert to authenticated with check ((select public.is_admin()));
create policy classes_admin_update on public.classes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy classes_admin_delete on public.classes for delete to authenticated using ((select public.is_admin()));

-- images: members read + update (guarded by trigger to status columns); admin insert/delete
create policy images_select on public.images for select to authenticated using ((select public.is_member()));
create policy images_admin_insert on public.images for insert to authenticated with check ((select public.is_admin()));
create policy images_member_update on public.images for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy images_admin_delete on public.images for delete to authenticated using ((select public.is_admin()));

-- annotations: members full CRUD, created_by must be self on insert
create policy annotations_select on public.annotations for select to authenticated using ((select public.is_member()));
create policy annotations_insert on public.annotations for insert to authenticated
  with check ((select public.is_member()) and created_by = (select auth.uid()));
create policy annotations_update on public.annotations for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy annotations_delete on public.annotations for delete to authenticated
  using ((select public.is_member()));

-- --------------------------------------------------------- SQL functions
-- Atomically reserve n consecutive image numbers. Returns first number and padding/prefix.
create or replace function public.allocate_image_numbers(p_dataset uuid, p_count int)
returns table (start_number int, name_prefix text, number_pad int)
language plpgsql security definer set search_path = '' as $$
declare
  v_start int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 5000 then raise exception 'invalid count' using errcode = '22023'; end if;

  update public.datasets d
     set next_number = d.next_number + p_count
   where d.id = p_dataset
  returning d.next_number - p_count, d.name_prefix, d.number_pad
  into v_start, name_prefix, number_pad;

  if v_start is null then raise exception 'dataset not found' using errcode = 'P0002'; end if;
  start_number := v_start;
  return next;
end $$;

create or replace function public.storage_usage()
returns json language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'storageBytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'images'), 0),
    'dbBytes',      pg_database_size(current_database()),
    'imageCount',   (select count(*) from public.images),
    'boxCount',     (select count(*) from public.annotations)
  ) into r;
  return r;
end $$;

-- Deletes images + annotations (and optionally classes). Returns storage paths so the
-- caller (server route, service role) can remove the objects via the Storage API.
create or replace function public.reset_dataset(
  p_dataset uuid,
  p_delete_classes boolean default false,
  p_new_start int default null,
  p_force boolean default false
) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
  v_exported timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select last_exported_at into v_exported from public.datasets where id = p_dataset for update;
  if not found then raise exception 'dataset not found' using errcode = 'P0002'; end if;
  if v_exported is null and not p_force then
    raise exception 'dataset has not been exported' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(storage_path), '{}') into v_paths from public.images where dataset_id = p_dataset;
  delete from public.annotations where image_id in (select id from public.images where dataset_id = p_dataset);
  delete from public.images where dataset_id = p_dataset;
  if p_delete_classes then delete from public.classes where dataset_id = p_dataset; end if;
  update public.datasets
     set next_number = coalesce(p_new_start, next_number), status = 'active'
   where id = p_dataset;
  return v_paths;
end $$;

revoke all on function public.allocate_image_numbers(uuid,int), public.storage_usage(),
  public.reset_dataset(uuid,boolean,int,boolean) from public, anon;
grant execute on function public.allocate_image_numbers(uuid,int), public.storage_usage(),
  public.reset_dataset(uuid,boolean,int,boolean) to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

create policy "images_read_members" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and (select public.is_member()));
create policy "images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (select public.is_admin()));
create policy "images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (select public.is_admin()))
  with check (bucket_id = 'images' and (select public.is_admin()));
create policy "images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));
