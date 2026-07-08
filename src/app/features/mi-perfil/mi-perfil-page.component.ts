import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User } from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  standalone: true,
  selector: 'app-mi-perfil-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 flex justify-center">
      <div class="w-full max-w-lg card p-5">
        <h2 class="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <lucide-icon [img]="userIcon" [size]="20" /> Mi perfil
        </h2>
        <p class="text-xs text-slate-500 mb-5">Actualiza tu información personal.</p>
        <div class="space-y-3">
          <div>
            <label class="input-label">Nombre completo</label>
            <input type="text" class="input" [(ngModel)]="fullName" name="fullName" />
          </div>
          <div>
            <label class="input-label">Correo</label>
            <input type="email" class="input bg-slate-50" [value]="auth.profile()?.email ?? ''" disabled />
          </div>
          <div>
            <label class="input-label">Rol</label>
            <input type="text" class="input bg-slate-50" [value]="auth.roleLabel()" disabled />
          </div>
          @if (error()) {
            <p class="text-xs text-red-600">{{ error() }}</p>
          }
          @if (success()) {
            <p class="text-xs text-emerald-600">{{ success() }}</p>
          }
          <button
            type="button"
            class="w-full py-2.5 rounded-md bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
            [disabled]="saving()"
            (click)="save()"
          >
            {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class MiPerfilPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);

  readonly userIcon = User;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  fullName = '';

  ngOnInit(): void {
    this.layout.setPage('Mi perfil', 'Datos de tu cuenta');
    this.fullName = this.auth.profile()?.full_name ?? '';
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const result = await this.auth.updateOwnProfile(this.fullName);
    this.saving.set(false);
    if (!result.ok) {
      this.error.set(result.error ?? 'Error al guardar');
    } else {
      this.success.set('Perfil actualizado.');
    }
  }
}
