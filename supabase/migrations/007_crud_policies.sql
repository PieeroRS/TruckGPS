-- TruckGPS — políticas CRUD para supervisores (pre-LLM)

-- Alertas IA: CRUD manual hasta conectar LLM
drop policy if exists ai_alerts_insert_staff on public.ai_alerts;
create policy ai_alerts_insert_staff on public.ai_alerts
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'supervisor'));

drop policy if exists ai_alerts_update_staff on public.ai_alerts;
create policy ai_alerts_update_staff on public.ai_alerts
  for update to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'))
  with check (public.current_user_role() in ('admin', 'supervisor'));

drop policy if exists ai_alerts_delete_staff on public.ai_alerts;
create policy ai_alerts_delete_staff on public.ai_alerts
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

-- Incidencias: eliminar (supervisor)
drop policy if exists incidents_delete_staff on public.incidents;
create policy incidents_delete_staff on public.incidents
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

-- Rutas nav: eliminar (supervisor)
drop policy if exists nav_routes_delete_staff on public.nav_routes;
create policy nav_routes_delete_staff on public.nav_routes
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'));

grant insert, update, delete on public.ai_alerts to authenticated;

notify pgrst, 'reload schema';
