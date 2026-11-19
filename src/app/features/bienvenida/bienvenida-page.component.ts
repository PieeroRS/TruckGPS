import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertCircle, ArrowLeft, ArrowRight, Bell, Check, Loader2, LucideAngularModule, ShieldCheck, Sparkles, Truck, User } from 'lucide-angular';

import { AuthService, PREFERENCIAS_DEFAULT, Preferencias } from '../../auth/auth.service';
import { passwordProblems } from '../../auth/cuenta-pages.component';
import { SettingsService } from '../../core/services/settings.service';
import { INACTIVIDAD, PreferenciasFormComponent } from './preferencias-form.component';

type Paso = 0 | 1 | 2 | 3;

/** CP002: asistente de configuración inicial del perfil. */
@Component({
  standalone: true,
  selector: 'app-bienvenida-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, PreferenciasFormComponent],
  template: `
    <div class="min-h-dvh bg-slate-50 flex items-start sm:items-center justify-center px-4 py-8">
      <div class="w-full max-w-xl">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-[#0b1220] flex items-center justify-center"><lucide-icon [img]="truckIcon" [size]="20" class="text-white" /></div>
          <div class="leading-tight">
            <p class="font-bold tracking-tight text-slate-900">Configura tu perfil</p>
            <p class="text-[12px] text-slate-500">{{ auth.profile()?.email }}</p>
          </div>
        </div>

        <!-- pasos -->
        <ol class="grid grid-cols-4 gap-2 mb-5" aria-label="Pasos">
          @for (p of pasos; track p.titulo; let i = $index) {
            <li class="flex flex-col gap-1.5">
              <span class="h-1.5 rounded-full transition-colors duration-300" [class]="i <= paso() ? 'bg-blue-600' : 'bg-slate-200'"></span>
              <span class="text-[11.5px] font-semibold" [class]="i === paso() ? 'text-slate-900' : 'text-slate-400'" [attr.aria-current]="i === paso() ? 'step' : null">{{ p.titulo }}</span>
            </li>
          }
        </ol>

        <div class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5 sm:p-7">
          <div class="flex items-center gap-2.5 mb-1">
            <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center"><lucide-icon [img]="pasos[paso()].icon" [size]="17" /></div>
            <h1 class="text-[18px] font-bold text-slate-900 tracking-tight">{{ pasos[paso()].titulo }}</h1>
          </div>
          <p class="text-[13px] text-slate-500 mb-5 ml-[46px]">{{ pasos[paso()].ayuda }}</p>

          @switch (paso()) {
            @case (0) {
              <div class="space-y-4">
                <div>
                  <label class="input-label" for="bv-name">Nombre completo</label>
                  <input id="bv-name" class="input" [(ngModel)]="nombre" name="nombre" autocomplete="name" />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="input-label" for="bv-tel">Teléfono (opcional)</label>
                    <input id="bv-tel" type="tel" class="input" [(ngModel)]="telefono" name="tel" placeholder="+51 987 654 321" />
                  </div>
                  @if (!auth.isStaff()) {
                    <div>
                      <label class="input-label" for="bv-lic">N.° de licencia (opcional)</label>
                      <input id="bv-lic" class="input uppercase" [(ngModel)]="licencia" name="lic" placeholder="Q12345678" />
                    </div>
                  }
                </div>
              </div>
            }
            @case (1) {
              <app-preferencias-form [prefs]="prefs" seccion="seguridad" />
              <div class="mt-4 pt-4 border-t border-slate-100">
                <label class="flex items-center gap-2 text-[13px] font-semibold text-slate-800 cursor-pointer">
                  <input type="checkbox" class="accent-blue-600 w-4 h-4" [(ngModel)]="cambiarPass" name="cambiar" />Cambiar mi contraseña ahora
                </label>
                @if (cambiarPass) {
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div><label class="input-label" for="bv-pa">Actual</label><input id="bv-pa" type="password" class="input" [(ngModel)]="passActual" name="pa" autocomplete="current-password" /></div>
                    <div><label class="input-label" for="bv-pn">Nueva</label><input id="bv-pn" type="password" class="input" [(ngModel)]="passNueva" name="pn" autocomplete="new-password" /></div>
                    <div><label class="input-label" for="bv-pr">Repite la nueva</label><input id="bv-pr" type="password" class="input" [(ngModel)]="passNueva2" name="pr" autocomplete="new-password" /></div>
                  </div>
                  <p class="text-[11.5px] text-slate-500 mt-1.5">Mínimo 8 caracteres, con letras y números.</p>
                }
              </div>
            }
            @case (2) {
              <app-preferencias-form [prefs]="prefs" seccion="notificaciones" [staff]="auth.isStaff()" />
            }
            @case (3) {
              <dl class="space-y-2.5 text-[13px]">
                <div class="resumen"><dt>Nombre</dt><dd>{{ nombre }}</dd></div>
                <div class="resumen"><dt>Teléfono</dt><dd>{{ telefono || 'Sin registrar' }}</dd></div>
                <div class="resumen"><dt>Cierre por inactividad</dt><dd>{{ inactividadLabel() }}</dd></div>
                <div class="resumen"><dt>Confirmar acciones críticas</dt><dd>{{ prefs.seguridad.confirmar_acciones ? 'Sí' : 'No' }}</dd></div>
                <div class="resumen"><dt>Avisos en la app</dt><dd>{{ prefs.notificaciones.en_app ? (prefs.notificaciones.sonido ? 'Con sonido' : 'Sin sonido') : 'Desactivados' }}</dd></div>
                <div class="resumen"><dt>Alertas que recibirás</dt><dd>{{ tiposLabel() }}</dd></div>
                @if (cambiarPass) { <div class="resumen"><dt>Contraseña</dt><dd>Se cambiará al guardar</dd></div> }
              </dl>
              <p class="text-[12px] text-slate-500 mt-4">Podrás cambiar todo esto cuando quieras en <strong>Mi perfil</strong>.</p>
            }
          }

          @if (error()) {
            <div class="flex items-start gap-2 p-3 mt-5 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in" role="alert">
              <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" /><p class="text-[13px] leading-snug">{{ error() }}</p>
            </div>
          }
          @if (exito()) {
            <div class="flex items-start gap-2 p-3 mt-5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 msg-in" role="status">
              <lucide-icon [img]="checkIcon" [size]="15" class="mt-0.5 shrink-0" /><p class="text-[13px] leading-snug">{{ exito() }}</p>
            </div>
          }

          <div class="flex items-center justify-between gap-2 mt-6">
            @if (paso() > 0) {
              <button type="button" class="nav-btn ghost" (click)="atras()" [disabled]="guardando()"><lucide-icon [img]="backIcon" [size]="15" />Atrás</button>
            } @else { <span></span> }
            @if (paso() < 3) {
              <button type="button" class="nav-btn dark" (click)="siguiente()">Siguiente<lucide-icon [img]="nextIcon" [size]="15" /></button>
            } @else {
              <button type="button" class="nav-btn dark" (click)="guardar()" [disabled]="guardando() || !!exito()">
                @if (guardando()) { <lucide-icon [img]="loaderIcon" [size]="15" class="animate-spin" />Guardando... } @else { <lucide-icon [img]="checkIcon" [size]="15" />Guardar y entrar }
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .resumen { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
      .resumen dt { color: #64748b; }
      .resumen dd { color: #0f172a; font-weight: 600; text-align: right; }
      .nav-btn { display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600; transition: all .15s; }
      .nav-btn.dark { background: #0b1220; color: #fff; }
      .nav-btn.dark:hover:not(:disabled) { background: #16233b; }
      .nav-btn.ghost { color: #334155; box-shadow: 0 0 0 1px #e2e8f0 inset; }
      .nav-btn:disabled { opacity: .5; cursor: not-allowed; }
    `
  ]
})
export class BienvenidaPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);

  readonly truckIcon = Truck;
  readonly alertIcon = AlertCircle;
  readonly checkIcon = Check;
  readonly loaderIcon = Loader2;
  readonly backIcon = ArrowLeft;
  readonly nextIcon = ArrowRight;

  readonly pasos = [
    { titulo: 'Tus datos', icon: User, ayuda: 'Así te verán tu equipo y el centro de control.' },
    { titulo: 'Seguridad', icon: ShieldCheck, ayuda: 'Protege tu cuenta, sobre todo en equipos compartidos.' },
    { titulo: 'Notificaciones', icon: Bell, ayuda: 'Elige cómo y qué alertas quieres recibir.' },
    { titulo: 'Confirmar', icon: Sparkles, ayuda: 'Revisa tu configuración antes de guardarla.' }
  ];
  readonly paso = signal<Paso>(0);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  nombre = '';
  telefono = '';
  licencia = '';
  prefs: Preferencias = JSON.parse(JSON.stringify(PREFERENCIAS_DEFAULT));
  cambiarPass = false;
  passActual = '';
  passNueva = '';
  passNueva2 = '';

  ngOnInit(): void {
    const p = this.auth.profile();
    this.nombre = p?.full_name ?? '';
    this.telefono = p?.telefono ?? '';
    this.licencia = p?.licencia ?? '';
    this.prefs = JSON.parse(JSON.stringify(this.auth.prefs()));
  }

  inactividadLabel(): string {
    return INACTIVIDAD.find((o) => o.value === this.prefs.seguridad.cerrar_por_inactividad_min)?.label ?? '—';
  }

  tiposLabel(): string {
    const n = this.prefs.notificaciones;
    const t = [n.alta_severidad && 'severidad alta', n.desvios && 'desvíos', n.velocidad && 'velocidad', n.incidencias && 'incidencias'].filter(Boolean);
    return t.length ? (t as string[]).join(', ') : 'Ninguna';
  }

  private validarPaso(): string | null {
    if (this.paso() === 0) {
      if (this.nombre.trim().length < 3) return 'Escribe tu nombre y apellido.';
      if (this.telefono.trim() && !/^\+?[0-9 ]{6,20}$/.test(this.telefono.trim())) return 'Teléfono inválido: usa solo números (opcional +51).';
      if (this.licencia.trim() && !/^[A-Za-z0-9-]{5,15}$/.test(this.licencia.trim())) return 'N.° de licencia inválido (5 a 15 letras o números).';
    }
    if (this.paso() === 1 && this.cambiarPass) {
      if (!this.passActual) return 'Escribe tu contraseña actual.';
      const p = passwordProblems(this.passNueva);
      if (p.length) return `La nueva contraseña debe tener ${p.join(', ')}.`;
      if (this.passNueva !== this.passNueva2) return 'Las contraseñas nuevas no coinciden.';
    }
    return null;
  }

  siguiente(): void {
    const e = this.validarPaso();
    this.error.set(e);
    if (!e) this.paso.update((p) => (p + 1) as Paso);
  }

  atras(): void {
    this.error.set(null);
    this.paso.update((p) => (p - 1) as Paso);
  }

  async guardar(): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    const perfil = await this.auth.updateOwnProfile({
      full_name: this.nombre.trim(),
      telefono: this.telefono.trim(),
      ...(this.auth.isStaff() ? {} : { licencia: this.licencia.trim().toUpperCase() })
    });
    if (!perfil.ok) return this.fallo(perfil.error, 0);
    if (this.cambiarPass) {
      const c = await this.auth.changePassword(this.passActual, this.passNueva, this.passNueva2);
      if (!c.ok) return this.fallo(c.error, 1);
    }
    const p = await this.auth.savePreferences(this.prefs, true);
    if (!p.ok) return this.fallo(p.error, 3);
    this.guardando.set(false);
    this.exito.set('¡Listo! Tu perfil quedó configurado. Entrando al panel...');
    await this.settings.ensureInterfaz(0);
    setTimeout(() => void this.router.navigate(['/' + this.settings.miInicio()], { queryParams: { bienvenida: 1 } }), 1300);
  }

  private fallo(msg: string | undefined, volverA: Paso): void {
    this.guardando.set(false);
    this.error.set(msg ?? 'No se pudo guardar.');
    this.paso.set(volverA);
  }
}
