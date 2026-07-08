-- TruckGPS — datos de ejemplo (máx. 3 por entidad)
-- Ejecutar DESPUÉS de migraciones. Usuario Auth creado aparte.

-- Vehículos (3)
insert into public.vehicles (placa, modelo, estado, ruta, kilometraje, prox_mantenimiento, lat, lng, velocidad) values
  ('ABC-123', 'Volvo FH 540', 'ok', 'Lima → Trujillo', 142850, '2026-06-12', -12.0464, -77.0428, 78),
  ('DGR-456', 'Scania R 450', 'warn', 'Arequipa → Cusco', 98430, '2026-05-18', -16.409, -71.537, 0),
  ('PER-789', 'Mercedes Actros', 'alert', 'Lima → Huancayo', 215120, '2026-05-09', -11.9404, -76.2356, 12)
on conflict (placa) do nothing;

-- Viaje activo (1)
insert into public.trips (vehicle_id, ruta, progress_pct, status)
select id, 'Lima → Trujillo', 68, 'active'::trip_status from public.vehicles where placa = 'ABC-123'
  and not exists (select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id where v.placa = 'ABC-123');

-- Alertas IA (3) — placeholder hasta LLM
insert into public.ai_alerts (titulo, descripcion, severidad, icon, placas_afectadas)
select * from (values
  ('Retraso en Carretera Central', 'Tráfico sugiere retrasos de 35-50 min. Unidades ABC-123 y PER-789 afectadas.', 'high'::incident_severity, 'alert-triangle', array['PER-789', 'ABC-123']::text[]),
  ('Mantenimiento — DGR-456', 'Revisión de transmisión recomendada en los próximos 5 días.', 'medium'::incident_severity, 'wrench', array['DGR-456']::text[]),
  ('Optimización Lima → Trujillo', 'Ruta alternativa por Cañete podría reducir 28 min.', 'low'::incident_severity, 'route', array['ABC-123']::text[])
) as t(titulo, descripcion, severidad, icon, placas_afectadas)
where (select count(*) from public.ai_alerts) = 0;

-- Incidencias (2)
insert into public.incidents (id, vehicle_id, titulo, categoria, severidad, estado, ubicacion, lat, lng, descripcion, asignado_a, es_panico, created_at, updated_at)
select 'INC-2026-0001', v.id, 'Falla en sistema de frenos', 'Mecánico', 'high'::incident_severity, 'en-atencion'::incident_status,
  'Carretera Central km 78, Chosica', -11.9404, -76.2356,
  'Pérdida de presión en frenos. Conductor reporta vibración al frenar.', 'Equipo Mecánico Lima Norte', false,
  now() - interval '2 hours', now() - interval '30 minutes'
from public.vehicles v where v.placa = 'PER-789'
on conflict (id) do nothing;

insert into public.incidents (id, vehicle_id, titulo, categoria, severidad, estado, ubicacion, lat, lng, descripcion, asignado_a, es_panico, created_at, updated_at)
select 'INC-2026-0002', v.id, 'Vehículo detenido sin reportar', 'Operativo', 'medium'::incident_severity, 'reportado'::incident_status,
  'Salida sur de Arequipa', -16.409, -71.537,
  'GPS muestra detención de 45 minutos sin reporte del conductor.', null, false,
  now() - interval '1 hour', now() - interval '1 hour'
from public.vehicles v where v.placa = 'DGR-456'
on conflict (id) do nothing;

insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0001', 'reportado'::incident_status, 'Incidencia registrada'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0001' and estado = 'reportado');
insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0001', 'asignado'::incident_status, 'Asignado a equipo mecánico'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0001' and estado = 'asignado');
insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0001', 'en-atencion'::incident_status, 'Técnico en camino'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0001' and estado = 'en-atencion');
insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0002', 'reportado'::incident_status, 'Incidencia registrada'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0002' and estado = 'reportado');
