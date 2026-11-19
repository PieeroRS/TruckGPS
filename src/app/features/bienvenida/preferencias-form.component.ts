import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Preferencias } from '../../auth/auth.service';

export const INACTIVIDAD = [
  { value: 0, label: 'Nunca' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' }
];

/** Preferencias de seguridad o de notificaciones (se usa en el asistente y en Mi perfil). */
@Component({
  standalone: true,
  selector: 'app-preferencias-form',
  imports: [CommonModule, FormsModule],
  template: `
    @if (seccion === 'seguridad') {
      <div class="space-y-4">
        <div>
          <label class="input-label" for="pf-inact">Cerrar sesión si no uso la app durante</label>
          <select id="pf-inact" class="select" [(ngModel)]="prefs.seguridad.cerrar_por_inactividad_min" name="inact">
            @for (o of inactividad; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
          </select>
          <p class="text-[11.5px] text-slate-500 mt-1.5">Recomendado en computadoras compartidas del centro de control.</p>
        </div>
        <label class="pref-row">
          <span>
            <span class="pref-title">Pedir confirmación en acciones críticas</span>
            <span class="pref-help">Antes de descartar alertas, eliminar registros o cerrar sesión.</span>
          </span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.seguridad.confirmar_acciones" name="confirm" />
        </label>
      </div>
    } @else {
      <div class="space-y-1">
        <label class="pref-row">
          <span><span class="pref-title">Avisos dentro de la app</span><span class="pref-help">Mensaje en pantalla cuando llega una alerta nueva.</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.en_app" name="enapp" />
        </label>
        <label class="pref-row" [class.opacity-50]="!prefs.notificaciones.en_app">
          <span><span class="pref-title">Sonido y vibración</span><span class="pref-help">Además del mensaje, suena o vibra el equipo.</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.sonido" name="sonido" [disabled]="!prefs.notificaciones.en_app" />
        </label>
        @if (staff) {
          <label class="pref-row">
            <span><span class="pref-title">Recibir alertas importantes por correo</span><span class="pref-help">Pánico, sabotaje e incidencias se envían a tu correo.</span></span>
            <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.correo" name="correo" />
          </label>
        }
        <p class="text-[11px] uppercase tracking-wider font-semibold text-slate-400 pt-3 pb-1">Qué alertas quiero recibir</p>
        <label class="pref-row">
          <span><span class="pref-title">Alertas de severidad alta</span><span class="pref-help">Sabotaje, spoofing, pánico. Siempre recomendadas.</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.alta_severidad" name="alta" />
        </label>
        <label class="pref-row">
          <span><span class="pref-title">Desvíos de ruta</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.desvios" name="desv" />
        </label>
        <label class="pref-row">
          <span><span class="pref-title">Exceso de velocidad</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.velocidad" name="vel" />
        </label>
        <label class="pref-row">
          <span><span class="pref-title">Incidencias reportadas</span></span>
          <input type="checkbox" class="pref-switch" [(ngModel)]="prefs.notificaciones.incidencias" name="inc" />
        </label>
      </div>
    }
  `,
  styles: [
    `
      .pref-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
      .pref-row:last-child { border-bottom: 0; }
      .pref-title { display: block; font-size: 13.5px; font-weight: 600; color: #0f172a; }
      .pref-help { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
      .pref-switch {
        appearance: none; -webkit-appearance: none; flex-shrink: 0; width: 40px; height: 23px; border-radius: 999px;
        background: #cbd5e1; position: relative; transition: background .2s; cursor: pointer;
      }
      .pref-switch::after {
        content: ''; position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%;
        background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .2s;
      }
      .pref-switch:checked { background: #2563eb; }
      .pref-switch:checked::after { transform: translateX(17px); }
      .pref-switch:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
      .pref-switch:disabled { cursor: not-allowed; }
    `
  ]
})
export class PreferenciasFormComponent {
  @Input({ required: true }) prefs!: Preferencias;
  @Input() seccion: 'seguridad' | 'notificaciones' = 'seguridad';
  @Input() staff = false;
  readonly inactividad = INACTIVIDAD;
}
