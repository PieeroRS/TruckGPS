import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideAngularModule,
  Truck, MapPin, ShieldCheck, Activity,
  Eye, EyeOff, ArrowRight, Loader2, AlertCircle
} from 'lucide-angular';
import { AuthService } from '../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-white">

      <!-- ══════════ PANEL DE MARCA ══════════ -->
      <aside class="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden
                    bg-[#0b1220] text-white">

        <!-- glow + grid decorativo -->
        <div class="pointer-events-none absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full
                    bg-blue-600/25 blur-[120px]"></div>
        <div class="pointer-events-none absolute bottom-[-140px] right-[-80px] w-[420px] h-[420px] rounded-full
                    bg-cyan-500/15 blur-[120px]"></div>
        <div class="pointer-events-none absolute inset-0 opacity-[0.07]"
             style="background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:56px 56px;"></div>

        <!-- logo -->
        <div class="relative flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur
                      flex items-center justify-center">
            <lucide-icon [img]="truckIcon" [size]="20" class="text-white" />
          </div>
          <div class="leading-tight">
            <p class="font-bold tracking-tight">TruckGPS</p>
            <p class="text-[11px] text-white/45">Control Center</p>
          </div>
        </div>

        <!-- claim -->
        <div class="relative max-w-[460px]">
          <h2 class="text-[40px] xl:text-[46px] font-bold leading-[1.08] tracking-tight">
            Toda tu flota,<br />
            <span class="text-blue-400">en una sola pantalla.</span>
          </h2>
          <p class="mt-5 text-[15px] text-white/55 leading-relaxed">
            Monitoreo GPS en tiempo real, detección inteligente de incidentes
            y trazabilidad completa de cada ruta.
          </p>

          <ul class="mt-10 space-y-4">
            @for (f of features; track f.label) {
              <li class="flex items-start gap-3.5">
                <div class="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-white/[0.07] ring-1 ring-white/10
                            flex items-center justify-center">
                  <lucide-icon [img]="f.icon" [size]="15" class="text-blue-300" />
                </div>
                <div>
                  <p class="text-sm font-medium text-white/90">{{ f.label }}</p>
                  <p class="text-[13px] text-white/45 mt-0.5">{{ f.desc }}</p>
                </div>
              </li>
            }
          </ul>
        </div>

        <!-- footer con métricas -->
        <div class="relative flex items-center gap-8 pt-8 border-t border-white/10">
          @for (s of stats; track s.label) {
            <div>
              <p class="text-lg font-bold tracking-tight">{{ s.value }}</p>
              <p class="text-[11px] text-white/40 uppercase tracking-wider">{{ s.label }}</p>
            </div>
          }
        </div>
      </aside>

      <!-- ══════════ FORMULARIO ══════════ -->
      <main class="flex items-center justify-center px-6 py-12 sm:px-10">
        <div class="w-full max-w-[380px]">

          <!-- logo compacto (solo móvil) -->
          <div class="lg:hidden flex items-center gap-3 mb-10">
            <div class="w-10 h-10 rounded-xl bg-[#0b1220] flex items-center justify-center">
              <lucide-icon [img]="truckIcon" [size]="20" class="text-white" />
            </div>
            <div class="leading-tight">
              <p class="font-bold tracking-tight text-slate-900">TruckGPS</p>
              <p class="text-[11px] text-slate-400">Control Center</p>
            </div>
          </div>

          <h1 class="text-[26px] font-bold text-slate-900 tracking-tight">Iniciar sesión</h1>
          <p class="text-sm text-slate-500 mt-1.5">Accede al panel de control de tu flota.</p>

          <form class="mt-7 space-y-4" (ngSubmit)="submit()" autocomplete="off">

            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                class="w-full h-11 px-3.5 rounded-lg text-sm text-slate-900
                       bg-white border border-slate-200 placeholder:text-slate-400
                       transition outline-none
                       focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="username"
                [(ngModel)]="username"
                placeholder="operaciones@truckgps.pe"
              />
            </div>

            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Contraseña</label>
              <div class="relative">
                <input
                  class="w-full h-11 pl-3.5 pr-11 rounded-lg text-sm text-slate-900
                         bg-white border border-slate-200 placeholder:text-slate-400
                         transition outline-none
                         focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  name="password"
                  [(ngModel)]="password"
                  [type]="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  (click)="showPassword = !showPassword"
                  class="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md
                         text-slate-400 hover:text-slate-600 hover:bg-slate-50
                         flex items-center justify-center transition"
                  [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  <lucide-icon [img]="showPassword ? eyeOffIcon : eyeIcon" [size]="16" />
                </button>
              </div>
            </div>

            @if (error) {
              <div class="flex items-start gap-2.5 p-3 rounded-lg
                          bg-red-50 border border-red-200 text-red-700">
                <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" />
                <p class="text-[13px] leading-snug">{{ error }}</p>
              </div>
            }

            <button
              type="submit"
              class="group w-full h-11 rounded-lg bg-[#0b1220] hover:bg-[#16233b]
                     text-white text-sm font-semibold tracking-tight
                     flex items-center justify-center gap-2
                     transition active:scale-[0.99]
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              [disabled]="submitting"
            >
              @if (submitting) {
                <lucide-icon [img]="loaderIcon" [size]="16" class="animate-spin" />
                <span>Verificando...</span>
              } @else {
                <span>Ingresar</span>
                <lucide-icon [img]="arrowIcon" [size]="16"
                             class="transition-transform group-hover:translate-x-0.5" />
              }
            </button>
          </form>

          <p class="text-[11px] text-slate-400 mt-3 text-center leading-relaxed">
            Supervisor: operaciones@truckgps.pe / password<br />
            Conductor: conductor@truckgps.pe / password
          </p>

          <p class="mt-8 text-center text-[12px] text-slate-400">
            © {{ year }} TruckGPS · Lima, Perú
          </p>
        </div>
      </main>
    </div>
  `
})
export class LoginPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly truckIcon = Truck;
  readonly eyeIcon = Eye;
  readonly eyeOffIcon = EyeOff;
  readonly arrowIcon = ArrowRight;
  readonly loaderIcon = Loader2;
  readonly alertIcon = AlertCircle;

  readonly year = new Date().getFullYear();

  readonly features = [
    { icon: MapPin,      label: 'Rastreo en tiempo real',   desc: 'Posición y ruta de cada unidad, al instante.' },
    { icon: Activity,    label: 'Detección de incidentes',  desc: 'Alertas automáticas ante desvíos y anomalías.' },
    { icon: ShieldCheck, label: 'Historial auditable',      desc: 'Evidencia con foto y audio en cada reporte.' }
  ];

  readonly stats = [
    { value: '24/7',   label: 'Monitoreo' },
    { value: '<3s',    label: 'Latencia'  },
    { value: '100%',   label: 'Trazable'  }
  ];

  username = '';
  password = '';
  error = '';
  submitting = false;
  showPassword = false;
  private redirectTo = '/dashboard';

  ngOnInit(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/login')) {
      this.redirectTo = redirect;
    }
  }

  async submit(): Promise<void> {
    this.error = '';
    this.submitting = true;
    const result = await this.auth.login(this.username.trim(), this.password);
    this.submitting = false;
    if (!result.ok) {
      this.error = result.error ?? 'Credenciales inválidas.';
      return;
    }
    await this.router.navigateByUrl(this.redirectTo);
  }
}
