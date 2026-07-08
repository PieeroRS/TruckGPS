-- TruckGPS — tracking para todas las cuentas + posición robusta
-- Corrige: solo supervisores (p.ej. thomas) podían reclamar/actualizar vehículos.
-- Los conductores fallaban en silencio (RLS UPDATE → 0 filas, sin error).

-- ---------------------------------------------------------------------------
-- Políticas UPDATE claras (sin FOR ALL confuso para conductores)
-- ---------------------------------------------------------------------------
drop policy if exists vehicles_write_supervisor on public.vehicles;
drop policy if exists vehicles_update_conductor on public.vehicles;
drop policy if exists vehicles_insert_staff on public.vehicles;
drop policy if exists vehicles_update_staff on public.vehicles;
drop policy if exists vehicles_delete_staff on public.vehicles;

create policy vehicles_insert_staff on public.vehicles
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'supervisor'));

create policy vehicles_update_staff on public.vehicles
  for update to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'))
  with check (public.current_user_role() in ('admin', 'supervisor'));

create policy vehicles_delete_staff on public.vehicles
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

-- Conductores (y staff en modo conductor) pueden reclamar/actualizar su unidad
create policy vehicles_update_conductor on public.vehicles
  for update to authenticated
  using (
    conductor_id is null
    or conductor_id = auth.uid()
  )
  with check (
    conductor_id is null
    or conductor_id = auth.uid()
  );

-- Posiciones: autenticados con vehículo asignado a ellos o staff
drop policy if exists positions_insert on public.vehicle_positions;
create policy positions_insert on public.vehicle_positions
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'supervisor')
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.conductor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: reclamar vehículo (evita UPDATE silencioso 0 filas)
-- ---------------------------------------------------------------------------
create or replace function public.claim_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vehicles;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  -- Asegurar perfil
  perform public.ensure_user_profile();

  select * into v from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Vehículo no encontrado';
  end if;

  if v.conductor_id is not null and v.conductor_id is distinct from uid then
    raise exception 'Este vehículo ya está asignado a otro conductor';
  end if;

  update public.vehicles
  set conductor_id = uid, estado = 'ok'
  where id = p_vehicle_id
  returning * into v;

  return v;
end;
$$;

grant execute on function public.claim_vehicle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: liberar vehículo
-- ---------------------------------------------------------------------------
create or replace function public.release_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  update public.vehicles
  set conductor_id = null, velocidad = 0
  where id = p_vehicle_id
    and conductor_id = uid;
end;
$$;

grant execute on function public.release_vehicle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: reportar posición (insert + sync vehículo en una llamada)
-- ---------------------------------------------------------------------------
create or replace function public.report_vehicle_position(
  p_vehicle_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_velocidad integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.vehicles;
  role user_role;
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then
    raise exception 'Vehículo no encontrado';
  end if;

  select public.current_user_role() into role;

  if v.conductor_id is distinct from uid
     and (role is null or role not in ('admin', 'supervisor')) then
    raise exception 'No puedes reportar posición de un vehículo que no es tuyo. Activa el GPS primero.';
  end if;

  -- Si staff prueba sin claim, auto-asigna
  if v.conductor_id is null then
    update public.vehicles set conductor_id = uid where id = p_vehicle_id;
  end if;

  insert into public.vehicle_positions (vehicle_id, lat, lng, velocidad)
  values (p_vehicle_id, p_lat, p_lng, coalesce(p_velocidad, 0));

  update public.vehicles
  set
    lat = p_lat,
    lng = p_lng,
    velocidad = coalesce(p_velocidad, 0),
    estado = 'ok',
    conductor_id = coalesce(conductor_id, uid)
  where id = p_vehicle_id;

  return jsonb_build_object(
    'ok', true,
    'vehicle_id', p_vehicle_id,
    'lat', p_lat,
    'lng', p_lng,
    'velocidad', coalesce(p_velocidad, 0),
    'recorded_at', now()
  );
end;
$$;

grant execute on function public.report_vehicle_position(uuid, double precision, double precision, integer) to authenticated;

notify pgrst, 'reload schema';
