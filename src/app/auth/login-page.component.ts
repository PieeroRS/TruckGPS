import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, Truck } from 'lucide-angular';
import { AuthService } from '../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="min-h-dvh grid place-items-center p-6 bg-slate-50">
      <div class="w-full max-w-[400px] card p-8">
        <div class="text-center mb-7">
          <div class="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <lucide-icon [img]="truckIcon" [size]="24" />
          </div>
          <h1 class="text-xl font-bold text-slate-900 tracking-tight">TruckGPS</h1>
          <p class="text-sm text-slate-500 mt-1">Control Center · Perú</p>
          @if (!auth.useSupabase) {
            <p class="text-[11px] text-slate-400 mt-2">Modo demo (sin Supabase configurado)</p>
          }
        </div>

        <form class="space-y-1" (ngSubmit)="submit()" autocomplete="off">
          <label class="input-label mt-3">{{ auth.useSupabase ? 'Email' : 'Usuario' }}</label>
          <input
            class="input"
            name="username"
            [(ngModel)]="username"
            [placeholder]="auth.useSupabase ? 'operaciones@truckgps.pe' : 'camionessa'"
          />

          <label class="input-label mt-3">Contraseña</label>
          <input class="input" name="password" [(ngModel)]="password" type="password" placeholder="password" />

          @if (error) {
            <div class="mt-3 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">{{ error }}</div>
          }

          <button
            type="submit"
            class="mt-5 w-full py-3 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-semibold text-sm transition disabled:opacity-60"
            [disabled]="submitting"
          >
            {{ submitting ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>
      </div>
    </div>
  `
})
export class LoginPageComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly truckIcon = Truck;

  username = '';
  password = '';
  error = '';
  submitting = false;

  async submit(): Promise<void> {
    this.error = '';
    this.submitting = true;
    const result = await this.auth.login(this.username.trim(), this.password);
    this.submitting = false;
    if (!result.ok) {
      this.error = result.error ?? 'Credenciales inválidas.';
      return;
    }
    await this.router.navigateByUrl('/dashboard');
  }
}
