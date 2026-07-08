-- TruckGPS — tracking en vivo para conductores + políticas Storage
-- Idempotente: se puede ejecutar más de una vez.

-- ---------------------------------------------------------------------------
-- Conductores: ver flota para elegir vehículo
-- ---------------------------------------------------------------------------
drop policy if exists vehicles_select_conductor_list on public.vehicles;
create policy vehicles_select_conductor_list on public.vehicles
  for select to authenticated
  using (public.current_user_role() = 'conductor');

-- Asignarse / liberar vehículo al activar o detener GPS
drop policy if exists vehicles_update_conductor on public.vehicles;
create policy vehicles_update_conductor on public.vehicles
  for update to authenticated
  using (
    public.current_user_role() in ('conductor', 'admin', 'supervisor')
    and (conductor_id is null or conductor_id = auth.uid())
  )
  with check (conductor_id is null or conductor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Posiciones: solo en el vehículo asignado al conductor
-- ---------------------------------------------------------------------------
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
-- Storage: subida y lectura para usuarios autenticados
-- ---------------------------------------------------------------------------
drop policy if exists storage_photos_insert on storage.objects;
create policy storage_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-photos');

drop policy if exists storage_photos_select on storage.objects;
create policy storage_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-photos');

drop policy if exists storage_audio_insert on storage.objects;
create policy storage_audio_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-audio');

drop policy if exists storage_audio_select on storage.objects;
create policy storage_audio_select on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-audio');
