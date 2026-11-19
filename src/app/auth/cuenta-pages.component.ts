import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, LucideAngularModule, MailCheck, Truck, UserPlus } from 'lucide-angular';

import { AuthService } from './auth.service';

const INPUT =
  'w-full h-11 px-3.5 rounded-lg text-sm text-slate-900 bg-white border border-slate-200 placeholder:text-slate-400 transition outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const BTN =
  'w-full h-11 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed';

/** Requisitos de la contraseña, iguales a los del servidor. */
export function passwordProblems(p: string): string[] {
  const out: string[] = [];
  if (p.length < 8) out.push('al menos 8 caracteres');
  if (!/[A-Za-z]/.test(p)) out.push('una letra');
  if (!/\d/.test(p)) out.push('un número');
  return out;
}

@Component({
  standalone: true,
  selector: 'app-cuenta-shell',
  imports: [LucideAngularModule, RouterLink],
  template: `
    <div class="min-h-dvh flex items-center justify-center bg-slate-50 px-5 py-10">
      <div class="w-full max-w-[420px]">
        <a routerLink="/login" class="flex items-center gap-3 mb-8 w-fit">
          <div class="w-10 h-10 rounded-xl bg-[#0b1220] flex items-center justify-center">
            <lucide-icon [img]="truckIcon" [size]="20" class="text-white" />
          </div>
          <div class="leading-tight">
            <p class="font-bold tracking-tight text-slate-900">TruckGPS</p>
            <p class="text-[11px] text-slate-400">Control Center</p>
          </div>
        </a>
        <div class="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6 sm:p-7 anim-in">
          <ng-content />
        </div>
        <a routerLink="/login" class="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800">
          <lucide-icon [img]="backIcon" [size]="14" />Volver a iniciar sesión
        </a>
      </div>
    </div>
  `
})
export class CuentaShellComponent {
  readonly truckIcon = Truck;
  readonly backIcon = ArrowLeft;
}

// ═══════════════════════ CP001: crear cuenta ═══════════════════════

@Component({
  standalone: true,
  selector: 'app-registro-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, CuentaShellComponent, RouterLink],
  template: `
    <app-cuenta-shell>
      @if (!hecho()) {
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center mb-4">
          <lucide-icon [img]="userPlusIcon" [size]="18" />
        </div>
        <h1 class="text-[22px] font-bold text-slate-900 tracking-tight">Crear cuenta</h1>
        <p class="text-sm text-slate-500 mt-1.5">Regístrate con tus datos. Te enviaremos un correo para verificar tu cuenta.</p>

        <form class="mt-6 space-y-4" (ngSubmit)="submit()" autocomplete="on">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rg-name">Nombre completo</label>
            <input id="rg-name" [class]="input" name="name" [(ngModel)]="nombre" placeholder="Nombre y apellido" autocomplete="name" required />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rg-mail">Correo electrónico</label>
            <input id="rg-mail" type="email" [class]="input" name="email" [(ngModel)]="email" placeholder="tucorreo@empresa.com" autocomplete="email" required />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rg-pass">Contraseña</label>
            <div class="relative">
              <input id="rg-pass" [type]="ver ? 'text' : 'password'" [class]="input + ' pr-11'" name="pass" [(ngModel)]="password" autocomplete="new-password" required />
              <button type="button" class="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md text-slate-400 hover:text-slate-600 flex items-center justify-center" (click)="ver = !ver" [attr.aria-label]="ver ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <lucide-icon [img]="ver ? eyeOffIcon : eyeIcon" [size]="16" />
              </button>
            </div>
            @if (password && faltan().length) {
              <p class="text-[11.5px] text-amber-700 mt-1.5">Debe tener {{ faltan().join(', ') }}.</p>
            } @else {
              <p class="text-[11.5px] text-slate-400 mt-1.5">Mínimo 8 caracteres, con letras y números.</p>
            }
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rg-pass2">Repite la contraseña</label>
            <input id="rg-pass2" [type]="ver ? 'text' : 'password'" [class]="input" name="pass2" [(ngModel)]="password2" autocomplete="new-password" required />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rg-code">Código de la empresa</label>
            <input id="rg-code" [class]="input + ' uppercase tracking-wider'" name="code" [(ngModel)]="codigo" placeholder="TG-XXXXXX" autocomplete="off" required />
            <p class="text-[11.5px] text-slate-400 mt-1.5">Te lo da tu supervisor. Así solo el personal de tu empresa puede crear cuentas.</p>
          </div>

          @if (error()) {
            <div class="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" />
              <p class="text-[13px] leading-snug">{{ error() }}</p>
            </div>
          }
          <button type="submit" [class]="btn" [disabled]="enviando()">
            @if (enviando()) { <lucide-icon [img]="loaderIcon" [size]="16" class="animate-spin" />Creando cuenta... } @else { Crear cuenta }
          </button>
        </form>
        <p class="mt-5 text-center text-[13px] text-slate-500">¿Ya tienes cuenta? <a routerLink="/login" class="font-semibold text-blue-600 hover:underline">Inicia sesión</a></p>
      } @else {
        <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4 ring-1" [class]="correoEnviado() ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-amber-50 text-amber-600 ring-amber-100'">
          <lucide-icon [img]="mailIcon" [size]="20" />
        </div>
        <h1 class="text-[21px] font-bold text-slate-900 tracking-tight">{{ correoEnviado() ? 'Revisa tu correo' : 'Cuenta creada' }}</h1>
        <p class="text-[14px] text-slate-600 mt-2 leading-relaxed">{{ hecho() }}</p>
        @if (correoEnviado()) {
          <p class="text-[12.5px] text-slate-500 mt-3 leading-relaxed">Abre el enlace del correo para activar tu cuenta y entrar. Si no lo ves, revisa la carpeta de spam o pide otro.</p>
          @if (reenvio()) { <p class="text-[12.5px] text-emerald-700 mt-3">{{ reenvio() }}</p> }
          <button type="button" class="mt-5 w-full h-10 rounded-lg ring-1 ring-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50" [disabled]="enviando()" (click)="reenviar()">Reenviar el correo</button>
        }
      }
    </app-cuenta-shell>
  `
})
export class RegistroPageComponent {
  private readonly auth = inject(AuthService);
  readonly input = INPUT;
  readonly btn = BTN;
  readonly userPlusIcon = UserPlus;
  readonly eyeIcon = Eye;
  readonly eyeOffIcon = EyeOff;
  readonly alertIcon = AlertCircle;
  readonly loaderIcon = Loader2;
  readonly mailIcon = MailCheck;

  nombre = '';
  email = '';
  password = '';
  password2 = '';
  codigo = '';
  ver = false;
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly hecho = signal<string | null>(null);
  readonly correoEnviado = signal(false);
  readonly reenvio = signal<string | null>(null);

  faltan(): string[] {
    return passwordProblems(this.password);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.nombre.trim().length < 3) return this.error.set('Escribe tu nombre y apellido.');
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(this.email.trim())) return this.error.set('Escribe un correo válido.');
    if (this.faltan().length) return this.error.set(`La contraseña debe tener ${this.faltan().join(', ')}.`);
    if (this.password !== this.password2) return this.error.set('Las contraseñas no coinciden.');
    if (!this.codigo.trim()) return this.error.set('Escribe el código de la empresa.');
    this.enviando.set(true);
    const r = await this.auth.register({
      full_name: this.nombre.trim(),
      email: this.email.trim(),
      password: this.password,
      password2: this.password2,
      codigo_empresa: this.codigo.trim()
    });
    this.enviando.set(false);
    if (!r.ok) return this.error.set(r.error ?? 'No se pudo crear la cuenta.');
    this.correoEnviado.set(!!r.correoEnviado);
    this.hecho.set(r.mensaje ?? 'Cuenta creada.');
  }

  async reenviar(): Promise<void> {
    this.enviando.set(true);
    const r = await this.auth.resendVerification(this.email.trim());
    this.enviando.set(false);
    this.reenvio.set(r.ok ? 'Listo, te enviamos un nuevo correo.' : (r.error ?? null));
  }
}

// ═══════════════════════ CP001 (paso 3): verificar el correo ═══════════════════════

@Component({
  standalone: true,
  selector: 'app-verificar-page',
  imports: [CommonModule, LucideAngularModule, CuentaShellComponent, RouterLink],
  template: `
    <app-cuenta-shell>
      @if (estado() === 'verificando') {
        <div class="flex items-center gap-3 text-slate-600"><lucide-icon [img]="loaderIcon" [size]="18" class="animate-spin" />Verificando tu correo...</div>
      } @else if (estado() === 'ok') {
        <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center mb-4">
          <lucide-icon [img]="checkIcon" [size]="20" />
        </div>
        <h1 class="text-[21px] font-bold text-slate-900 tracking-tight">Correo verificado</h1>
        <p class="text-[14px] text-slate-600 mt-2">Tu cuenta está activa. Te llevamos a configurar tu perfil...</p>
      } @else {
        <div class="w-11 h-11 rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 flex items-center justify-center mb-4">
          <lucide-icon [img]="alertIcon" [size]="20" />
        </div>
        <h1 class="text-[21px] font-bold text-slate-900 tracking-tight">No se pudo verificar</h1>
        <p class="text-[14px] text-slate-600 mt-2">{{ error() }}</p>
        <p class="text-[12.5px] text-slate-500 mt-3">Inicia sesión con tu correo: si falta verificarlo, podrás pedir un enlace nuevo.</p>
        <a routerLink="/login" class="mt-5 w-full h-11 rounded-lg bg-[#0b1220] text-white text-sm font-semibold flex items-center justify-center">Ir a iniciar sesión</a>
      }
    </app-cuenta-shell>
  `
})
export class VerificarPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly loaderIcon = Loader2;
  readonly checkIcon = Check;
  readonly alertIcon = AlertCircle;
  readonly estado = signal<'verificando' | 'ok' | 'error'>('verificando');
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    const r = await this.auth.verifyEmail(token);
    if (!r.ok) {
      this.error.set(r.error ?? 'El enlace no es válido.');
      this.estado.set('error');
      return;
    }
    this.estado.set('ok');
    setTimeout(() => void this.router.navigateByUrl('/bienvenida'), 1200);
  }
}

// ═══════════════════════ CP004: recuperar la contraseña ═══════════════════════

@Component({
  standalone: true,
  selector: 'app-recuperar-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, CuentaShellComponent],
  template: `
    <app-cuenta-shell>
      <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center mb-4">
        <lucide-icon [img]="keyIcon" [size]="18" />
      </div>
      <h1 class="text-[22px] font-bold text-slate-900 tracking-tight">Recuperar contraseña</h1>
      @if (!mensaje()) {
        <p class="text-sm text-slate-500 mt-1.5">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
        <form class="mt-6 space-y-4" (ngSubmit)="submit()">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rc-mail">Correo electrónico</label>
            <input id="rc-mail" type="email" [class]="input" name="email" [(ngModel)]="email" placeholder="tucorreo@empresa.com" autocomplete="email" required />
          </div>
          @if (error()) {
            <div class="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" />
              <p class="text-[13px] leading-snug">{{ error() }}</p>
            </div>
          }
          <button type="submit" [class]="btn" [disabled]="enviando()">
            @if (enviando()) { <lucide-icon [img]="loaderIcon" [size]="16" class="animate-spin" />Enviando... } @else { Enviar enlace }
          </button>
        </form>
      } @else {
        <div class="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          <lucide-icon [img]="checkIcon" [size]="15" class="mt-0.5 shrink-0" />
          <p class="text-[13px] leading-snug">{{ mensaje() }}</p>
        </div>
        <p class="text-[12.5px] text-slate-500 mt-3 leading-relaxed">El enlace vence en 60 minutos y sirve una sola vez. Si no te llega, pide a tu supervisor que te ayude.</p>
      }
    </app-cuenta-shell>
  `
})
export class RecuperarPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly input = INPUT;
  readonly btn = BTN;
  readonly keyIcon = KeyRound;
  readonly alertIcon = AlertCircle;
  readonly loaderIcon = Loader2;
  readonly checkIcon = Check;
  email = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(this.email.trim())) return this.error.set('Escribe un correo válido.');
    this.enviando.set(true);
    const r = await this.auth.requestReset(this.email.trim());
    this.enviando.set(false);
    if (!r.ok) return this.error.set(r.error ?? 'No se pudo enviar el enlace.');
    this.mensaje.set(r.mensaje ?? 'Revisa tu correo.');
  }
}

// ═══════════════════════ CP004 (pasos 3 y 4): nueva contraseña ═══════════════════════

@Component({
  standalone: true,
  selector: 'app-restablecer-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, CuentaShellComponent, RouterLink],
  template: `
    <app-cuenta-shell>
      <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center mb-4">
        <lucide-icon [img]="keyIcon" [size]="18" />
      </div>
      <h1 class="text-[22px] font-bold text-slate-900 tracking-tight">Nueva contraseña</h1>
      @if (estado() === 'cargando') {
        <div class="mt-4 flex items-center gap-3 text-slate-600"><lucide-icon [img]="loaderIcon" [size]="18" class="animate-spin" />Revisando el enlace...</div>
      } @else if (estado() === 'invalido') {
        <p class="text-[14px] text-slate-600 mt-2">{{ error() }}</p>
        <a routerLink="/recuperar" class="mt-5 w-full h-11 rounded-lg bg-[#0b1220] text-white text-sm font-semibold flex items-center justify-center">Pedir un enlace nuevo</a>
      } @else if (estado() === 'hecho') {
        <div class="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          <lucide-icon [img]="checkIcon" [size]="15" class="mt-0.5 shrink-0" />
          <p class="text-[13px] leading-snug">{{ mensaje() }}</p>
        </div>
        <a routerLink="/login" [queryParams]="{ email: cuenta() }" class="mt-5 w-full h-11 rounded-lg bg-[#0b1220] text-white text-sm font-semibold flex items-center justify-center">Iniciar sesión</a>
      } @else {
        <p class="text-sm text-slate-500 mt-1.5">Para la cuenta <strong class="text-slate-700">{{ cuenta() }}</strong>.</p>
        <form class="mt-6 space-y-4" (ngSubmit)="submit()">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rs-pass">Nueva contraseña</label>
            <input id="rs-pass" [type]="ver ? 'text' : 'password'" [class]="input" name="pass" [(ngModel)]="password" autocomplete="new-password" required />
            <p class="text-[11.5px] mt-1.5" [class]="password && problemas().length ? 'text-amber-700' : 'text-slate-400'">
              {{ password && problemas().length ? 'Debe tener ' + problemas().join(', ') + '.' : 'Mínimo 8 caracteres, con letras y números.' }}
            </p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5" for="rs-pass2">Confirma la contraseña</label>
            <input id="rs-pass2" [type]="ver ? 'text' : 'password'" [class]="input" name="pass2" [(ngModel)]="password2" autocomplete="new-password" required />
            @if (password2 && password2 !== password) { <p class="text-[11.5px] text-amber-700 mt-1.5">Las contraseñas no coinciden.</p> }
          </div>
          <label class="flex items-center gap-2 text-[12.5px] text-slate-600"><input type="checkbox" class="accent-blue-600" [(ngModel)]="ver" name="ver" />Mostrar contraseñas</label>
          @if (error()) {
            <div class="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" />
              <p class="text-[13px] leading-snug">{{ error() }}</p>
            </div>
          }
          <button type="submit" [class]="btn" [disabled]="enviando()">
            @if (enviando()) { <lucide-icon [img]="loaderIcon" [size]="16" class="animate-spin" />Guardando... } @else { Guardar nueva contraseña }
          </button>
        </form>
      }
    </app-cuenta-shell>
  `
})
export class RestablecerPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly input = INPUT;
  readonly btn = BTN;
  readonly keyIcon = KeyRound;
  readonly alertIcon = AlertCircle;
  readonly loaderIcon = Loader2;
  readonly checkIcon = Check;
  private token = '';
  password = '';
  password2 = '';
  ver = false;
  readonly estado = signal<'cargando' | 'form' | 'invalido' | 'hecho'>('cargando');
  readonly cuenta = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);

  problemas(): string[] {
    return passwordProblems(this.password);
  }

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    const r = await this.auth.checkResetToken(this.token);
    if (!r.ok) {
      this.error.set(r.error ?? 'El enlace no es válido.');
      this.estado.set('invalido');
      return;
    }
    this.cuenta.set(r.email ?? '');
    this.estado.set('form');
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.problemas().length) return this.error.set(`La contraseña debe tener ${this.problemas().join(', ')}.`);
    if (this.password !== this.password2) return this.error.set('Las contraseñas no coinciden.');
    this.enviando.set(true);
    const r = await this.auth.resetPassword(this.token, this.password, this.password2);
    this.enviando.set(false);
    if (!r.ok) return this.error.set(r.error ?? 'No se pudo cambiar la contraseña.');
    this.mensaje.set(r.mensaje ?? 'Contraseña actualizada.');
    this.estado.set('hecho');
  }
}
