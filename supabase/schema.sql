-- ESCP Room Finder — Supabase schema.
--
-- Run this once against a new project, then add yourself to `admins`.
--
-- SECURITY, READ THIS: the anon key ships inside the public JS bundle by
-- design, so row-level security is the ONLY wall. Supabase enables public email
-- sign-up by default, which means a policy written as
--   using (auth.role() = 'authenticated')
-- would let any stranger self-register and then write to the campus data.
-- Gate on the admins table AND disable public sign-up in
-- Authentication -> Providers -> Email -> "Allow new users to sign up".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- floor_maps
-- Keyed by SHEET, not by (building, level): one published plan legitimately
-- covers several buildings (the B/C/D overview), so `buildings` is an array and
-- `sort_order` picks the default when more than one sheet matches.
create table if not exists public.floor_maps (
  slug          text primary key,
  label         text not null,
  buildings     text[] not null,
  level         smallint not null check (level between -1 and 2),
  fallback_path text not null,               -- committed copy under /maps
  storage_path  text,                        -- null until an admin uploads
  width         int not null default 2000,
  height        int not null default 1120,
  plan_rect     jsonb,
  image_version int not null default 1,      -- bumped on a reframing upload
  sort_order    int not null default 100,
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------- rooms
create table if not exists public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  building         char(1) not null check (building in ('B','C','D')),
  level            smallint not null check (level between -1 and 2),
  category         text not null,
  aliases          text[] not null default '{}',
  note             text,
  -- Validated against the in-repo route graph by scripts/validate-graph.ts,
  -- not by a foreign key: the graph is code, not data.
  access_node      text not null,
  local_hint       text,
  map_slug         text references public.floor_maps(slug) on delete set null,
  pin_x            real check (pin_x between 0 and 1),
  pin_y            real check (pin_y between 0 and 1),
  shape            jsonb,
  -- Which floor_maps.image_version these coordinates were authored against.
  -- The client hides pins whose version has fallen behind, rather than drawing
  -- them in the wrong place.
  geometry_version int not null default 1,
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint rooms_pin_needs_map check (
    (map_slug is null and pin_x is null and pin_y is null)
    or (map_slug is not null and pin_x is not null and pin_y is not null)
  )
);

create index if not exists rooms_building_level_idx on public.rooms (building, level);
create index if not exists rooms_active_idx        on public.rooms (is_active);
create index if not exists rooms_aliases_idx       on public.rooms using gin (aliases);

-- ------------------------------------------------------------ updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

drop trigger if exists floor_maps_touch on public.floor_maps;
create trigger floor_maps_touch before update on public.floor_maps
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- audit
-- One admin account is one bulk edit away from flattening the dataset and
-- there is no other safety net, so keep a change history.
create table if not exists public.rooms_audit (
  audit_id bigserial primary key,
  room_id  uuid,
  code     text,
  op       text not null,
  before   jsonb,
  after    jsonb,
  actor    uuid default auth.uid(),
  at       timestamptz not null default now()
);

create or replace function public.audit_rooms() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rooms_audit (room_id, code, op, before, after)
  values (
    coalesce(new.id, old.id),
    coalesce(new.code, old.code),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists rooms_audit_trg on public.rooms;
create trigger rooms_audit_trg after insert or update or delete on public.rooms
  for each row execute function public.audit_rooms();

-- -------------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text not null,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;  -- no policies => unreadable via the API

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ----------------------------------------------------------------------- RLS
alter table public.rooms       enable row level security;
alter table public.floor_maps  enable row level security;
alter table public.rooms_audit enable row level security;

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms
  for select to anon, authenticated using (is_active);

drop policy if exists rooms_admin_all on public.rooms;
create policy rooms_admin_all on public.rooms
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists maps_public_read on public.floor_maps;
create policy maps_public_read on public.floor_maps
  for select to anon, authenticated using (true);

drop policy if exists maps_admin_all on public.floor_maps;
create policy maps_admin_all on public.floor_maps
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_admin_read on public.rooms_audit;
create policy audit_admin_read on public.rooms_audit
  for select to authenticated using (public.is_admin());

revoke all on public.rooms, public.floor_maps from anon;
grant select on public.rooms, public.floor_maps to anon;

-- --------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('floor-maps', 'floor-maps', true)
on conflict (id) do nothing;

drop policy if exists maps_obj_read on storage.objects;
create policy maps_obj_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'floor-maps');

drop policy if exists maps_obj_write on storage.objects;
create policy maps_obj_write on storage.objects
  for all to authenticated
  using (bucket_id = 'floor-maps' and public.is_admin())
  with check (bucket_id = 'floor-maps' and public.is_admin());

-- After running this:
--   1. Authentication -> Providers -> Email: turn OFF "Allow new users to sign up".
--   2. Invite yourself, then:
--        insert into public.admins (user_id, email)
--        select id, email from auth.users where email = 'you@escp.eu';
--   3. Seed the tables: npm run seed
