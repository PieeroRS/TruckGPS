-- TruckGPS — esquema inicial Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type user_role as enum ('admin', 'supervisor', 'conductor');
create type vehicle_status as enum ('ok', 'warn', 'alert', 'offline');
create type incident_severity as enum ('high', 'medium', 'low');
create type incident_status as enum ('reportado', 'asignado', 'en-atencion', 'resuelto');
create type attachment_type as enum ('photo', 'audio');
create type trip_status as enum ('active', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Perfiles (extiende auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'conductor',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'supervisor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null,
  conductor_id uuid references public.profiles (id) on delete set null,
  estado vehicle_status not null default 'ok',
  ruta text,
  kilometraje integer not null default 0,
  prox_mantenimiento date,
  lat double precision,
  lng double precision,
  velocidad integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Posiciones (historial + realtime)
-- ---------------------------------------------------------------------------
create table public.vehicle_positions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  velocidad integer not null default 0,
  recorded_at timestamptz not null default now()
);

create index idx_vehicle_positions_vehicle_time
  on public.vehicle_positions (vehicle_id, recorded_at desc);

create or replace function public.sync_vehicle_position()
returns trigger
language plpgsql
as $$
begin
  update public.vehicles
  set
    lat = new.lat,
    lng = new.lng,
    velocidad = new.velocidad,
    updated_at = now()
  where id = new.vehicle_id;
  return new;
end;
$$;

create trigger on_vehicle_position_insert
  after insert on public.vehicle_positions
  for each row execute function public.sync_vehicle_position();

-- ---------------------------------------------------------------------------
-- Viajes activos (dashboard)
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  ruta text not null,
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  status trip_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Incidencias
-- ---------------------------------------------------------------------------
create table public.incidents (
  id text primary key,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  reported_by uuid references public.profiles (id) on delete set null,
  titulo text not null,
  categoria text not null,
  severidad incident_severity not null,
  estado incident_status not null default 'reportado',
  ubicacion text not null,
  lat double precision,
  lng double precision,
  descripcion text not null,
  asignado_a text,
  es_panico boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references public.incidents (id) on delete cascade,
  estado incident_status not null,
  notas text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references public.incidents (id) on delete cascade,
  type attachment_type not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alertas IA
-- ---------------------------------------------------------------------------
create table public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null,
  severidad incident_severity not null,
  icon text not null default 'alert-triangle',
  placas_afectadas text[] not null default '{}',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vista: flota con conductor y última posición
-- ---------------------------------------------------------------------------
create or replace view public.vehicles_live as
select
  v.id,
  v.placa,
  v.modelo,
  v.estado,
  v.ruta,
  v.kilometraje,
  v.prox_mantenimiento,
  coalesce(p.full_name, 'Sin asignar') as conductor,
  coalesce(v.lat, -12.0464) as lat,
  coalesce(v.lng, -77.0428) as lng,
  coalesce(v.velocidad, 0) as velocidad
from public.vehicles v
left join public.profiles p on p.id = v.conductor_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.trips enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.ai_alerts enable row level security;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Perfiles: leer el propio; supervisores leen todos
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_role() in ('admin', 'supervisor'));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid());

-- Vehículos: supervisores/admin todo; conductores su vehículo
create policy vehicles_select on public.vehicles
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'supervisor')
    or conductor_id = auth.uid()
  );

create policy vehicles_write_supervisor on public.vehicles
  for all to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'))
  with check (public.current_user_role() in ('admin', 'supervisor'));

-- Posiciones
create policy positions_select on public.vehicle_positions
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'supervisor')
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.conductor_id = auth.uid()
    )
  );

create policy positions_insert on public.vehicle_positions
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'supervisor', 'conductor')
  );

-- Incidencias
create policy incidents_select on public.incidents
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'supervisor')
    or reported_by = auth.uid()
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.conductor_id = auth.uid()
    )
  );

create policy incidents_insert on public.incidents
  for insert to authenticated
  with check (true);

create policy incidents_update_supervisor on public.incidents
  for update to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

-- Eventos y adjuntos
create policy incident_events_select on public.incident_events
  for select to authenticated using (true);

create policy incident_events_insert on public.incident_events
  for insert to authenticated with check (true);

create policy incident_attachments_select on public.incident_attachments
  for select to authenticated using (true);

create policy incident_attachments_insert on public.incident_attachments
  for insert to authenticated with check (true);

-- Trips y alertas IA: lectura para autenticados
create policy trips_select on public.trips
  for select to authenticated using (true);

create policy ai_alerts_select on public.ai_alerts
  for select to authenticated using (activa = true);

-- ---------------------------------------------------------------------------
-- Realtime (habilitar en Dashboard → Database → Replication si hace falta)
-- alter publication supabase_realtime add table public.vehicle_positions;
