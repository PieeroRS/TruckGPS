import * as L from 'leaflet';
import { Vehicle, VehicleStatus } from '../models/vehicle.model';

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

export function vehicleStatusInfo(estado: VehicleStatus) {
  return (
    {
      ok: { label: 'En ruta', className: 'ok', badge: 'badge-success', dot: 'bg-emerald-500' },
      warn: { label: 'Detenido', className: 'warn', badge: 'badge-warning', dot: 'bg-amber-500' },
      alert: { label: 'Alerta', className: 'alert', badge: 'badge-danger', dot: 'bg-red-500' },
      offline: { label: 'Offline', className: 'ok', badge: 'badge-neutral', dot: 'bg-slate-400' }
    } as const
  )[estado];
}

export function buildTruckIcon(estado: VehicleStatus): L.DivIcon {
  const cls = vehicleStatusInfo(estado).className;
  return L.divIcon({
    className: '',
    html: `<div class="truck-marker ${cls}">${TRUCK_SVG}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

export function bindVehicleTooltip(marker: L.Marker, v: Vehicle): void {
  const info = vehicleStatusInfo(v.estado);
  marker.bindTooltip(
    `<strong>${v.placa}</strong> · ${v.conductor}<br/>${info.label} · ${v.ruta}`,
    { direction: 'top', offset: [0, -10], className: 'truck-tooltip' }
  );
}

export function createOsmMap(el: HTMLElement, center: [number, number], zoom: number): L.Map {
  const map = L.map(el, { center, zoom, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  return map;
}

export function formatKm(km: number): string {
  return km.toLocaleString('es-PE') + ' km';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}
