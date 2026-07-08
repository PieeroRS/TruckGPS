-- Completar seed si la primera ejecución falló a medias (vehículos ya insertados)
insert into public.trips (vehicle_id, ruta, progress_pct, status)
select id, 'Lima → Trujillo', 68, 'active'::trip_status from public.vehicles where placa = 'ABC-123'
  and not exists (select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id where v.placa = 'ABC-123')
union all
select id, 'Arequipa → Cusco', 42, 'active'::trip_status from public.vehicles where placa = 'DGR-456'
  and not exists (select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id where v.placa = 'DGR-456')
union all
select id, 'Trujillo → Chiclayo', 85, 'active'::trip_status from public.vehicles where placa = 'TGS-901'
  and not exists (select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id where v.placa = 'TGS-901')
union all
select id, 'Lima → Pisco', 94, 'active'::trip_status from public.vehicles where placa = 'LMA-202'
  and not exists (select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id where v.placa = 'LMA-202');

insert into public.ai_alerts (titulo, descripcion, severidad, icon, placas_afectadas)
select * from (values
  ('Retraso detectado en Carretera Central', 'Patrón de tráfico sugiere retrasos de 35-50 min en las próximas 2h. 3 unidades afectadas.', 'high'::incident_severity, 'alert-triangle', array['PER-789', 'ABC-123', 'TRJ-013']::text[]),
  ('Riesgo de mantenimiento — DGR-456', 'Modelo predictivo: 78% probabilidad de falla en transmisión en próximos 5 días.', 'medium'::incident_severity, 'wrench', array['DGR-456']::text[]),
  ('Zona de alto riesgo — Panamericana Norte', 'Aumento del 40% en incidentes de seguridad en km 980-1050 últimas 72h.', 'high'::incident_severity, 'shield-alert', array['PIU-101']::text[]),
  ('Optimización de ruta — Lima → Pisco', 'Ruta alternativa por Cañete reduce tiempo estimado en 28 min.', 'low'::incident_severity, 'route', array['LMA-202']::text[]),
  ('Fatiga de conductor detectada', 'Patrón de conducción de Hugo Mamani sugiere fatiga. Recomendar descanso.', 'medium'::incident_severity, 'moon', array['TRJ-013']::text[])
) as t(titulo, descripcion, severidad, icon, placas_afectadas)
where not exists (select 1 from public.ai_alerts limit 1);

insert into public.incidents (id, vehicle_id, titulo, categoria, severidad, estado, ubicacion, lat, lng, descripcion, asignado_a, es_panico, created_at, updated_at)
select
  'INC-2026-0142',
  v.id,
  'Falla en sistema de frenos',
  'Mecánico',
  'high'::incident_severity,
  'en-atencion'::incident_status,
  'Carretera Central km 78, Chosica',
  -11.9404,
  -76.2356,
  'El sistema de frenos presenta pérdida de presión. Conductor reporta vibración al frenar a alta velocidad.',
  'Equipo Mecánico Lima Norte',
  false,
  '2026-05-06T08:42:00+00',
  '2026-05-06T11:15:00+00'
from public.vehicles v where v.placa = 'PER-789'
on conflict (id) do nothing;

insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0142', 'reportado'::incident_status, 'Incidencia registrada'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0142' and estado = 'reportado');
insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0142', 'asignado'::incident_status, 'Asignado a equipo mecánico'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0142' and estado = 'asignado');
insert into public.incident_events (incident_id, estado, notas)
select 'INC-2026-0142', 'en-atencion'::incident_status, 'Técnico en camino'
where not exists (select 1 from public.incident_events where incident_id = 'INC-2026-0142' and estado = 'en-atencion');
