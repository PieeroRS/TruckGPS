-- TruckGPS — mapa en vivo: lectura de flota para usuarios autenticados

-- Vista respeta permisos del usuario que consulta
alter view public.vehicles_live set (security_invoker = on);

grant select on public.vehicles_live to authenticated;
grant select on public.vehicles_live to anon;

-- Todos los autenticados pueden ver vehículos en el mapa (supervisores + conductores)
drop policy if exists vehicles_select_authenticated on public.vehicles;
create policy vehicles_select_authenticated on public.vehicles
  for select to authenticated
  using (true);

-- Lectura de posiciones para el mapa en vivo
drop policy if exists positions_select_authenticated on public.vehicle_positions;
create policy positions_select_authenticated on public.vehicle_positions
  for select to authenticated
  using (true);
