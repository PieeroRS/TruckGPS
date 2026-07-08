-- TruckGPS — rutas origen → destino (idempotente, ejecutar en SQL Editor)

do $$ begin
  create type nav_route_status as enum (
    'solicitada', 'asignada', 'en-curso', 'completada', 'cancelada'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.nav_routes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  origin_name text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_name text not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  route_label text not null,
  distance_km numeric(10, 2),
  duration_min integer,
  geometry jsonb,
  status nav_route_status not null default 'solicitada',
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  fare_estimate numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_nav_routes_status on public.nav_routes (status);
create index if not exists idx_nav_routes_vehicle on public.nav_routes (vehicle_id);

alter table public.nav_routes enable row level security;

drop policy if exists nav_routes_select_staff on public.nav_routes;
create policy nav_routes_select_staff on public.nav_routes
  for select to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

drop policy if exists nav_routes_insert_authenticated on public.nav_routes;
create policy nav_routes_insert_authenticated on public.nav_routes
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists nav_routes_update_staff on public.nav_routes;
create policy nav_routes_update_staff on public.nav_routes
  for update to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'))
  with check (public.current_user_role() in ('admin', 'supervisor'));

drop policy if exists nav_routes_select_driver on public.nav_routes;
create policy nav_routes_select_driver on public.nav_routes
  for select to authenticated
  using (driver_id = auth.uid() or created_by = auth.uid());

drop policy if exists nav_routes_update_driver on public.nav_routes;
create policy nav_routes_update_driver on public.nav_routes
  for update to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists nav_routes_update_creator on public.nav_routes;
create policy nav_routes_update_creator on public.nav_routes
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

grant select, insert, update on public.nav_routes to authenticated;

create or replace function public.sync_vehicle_route_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicle_id is not null and new.status in ('asignada', 'en-curso') then
    update public.vehicles
    set ruta = new.route_label, updated_at = now()
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_nav_route_vehicle on public.nav_routes;
create trigger on_nav_route_vehicle
  after insert or update of vehicle_id, status, route_label on public.nav_routes
  for each row execute function public.sync_vehicle_route_label();

-- Recargar caché PostgREST
notify pgrst, 'reload schema';
