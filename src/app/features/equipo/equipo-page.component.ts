import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Loader2,
  LucideAngularModule,
  Pencil,
  Plus,
  Search,
  Shield,
  User,
  UserPlus,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import {
  CreateDriverInput,
  ProfileRow,
  ProfileRole,
  ProfilesService
} from '../../core/services/profiles.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  standalone: true,
  selector: 'app-equipo-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Equipo y conductores</h2>
          <p class="text-xs text-slate-500 mt-1">Administra perfiles, roles y altas de conductores.</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          (click)="openCreate()"
        >
          <lucide-icon [img]="plusIcon" [size]="14" />Agregar conductor
        </button>
      </div>

      <div class="card p-4 mb-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <lucide-icon [img]="userIcon" [size]="16" /> Mi perfil
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div class="md:col-span-5">
            <label class="input-label">Nombre completo</label>
            <input type="text" class="input" [(ngModel)]="ownName" name="ownName" />
          </div>
          <div class="md:col-span-4">
            <label class="input-label">Correo</label>
            <input type="email" class="input bg-slate-50" [value]="auth.profile()?.email ?? ''" disabled />
          </div>
          <div class="md:col-span-3">
            <button
              type="button"
              class="w-full px-3 py-2 rounded-md bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition disabled:opacity-50"
              [disabled]="savingOwn()"
              (click)="saveOwnProfile()"
            >
              @if (savingOwn()) { Guardando... } @else { Guardar mi perfil }
            </button>
          </div>
        </div>
      </div>

      <div class="card p-4 mb-5">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-8">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" class="input pl-9" placeholder="Nombre o correo..." [(ngModel)]="busqueda" />
            </div>
          </div>
          <div class="md:col-span-4">
            <label class="input-label">Rol</label>
            <select class="select" [(ngModel)]="filtroRol">
              <option value="todos">Todos</option>
              <option value="conductor">Conductores</option>
              <option value="supervisor">Supervisores</option>
              <option value="admin">Administradores</option>
            </select>
          </div>
        </div>
      </div>

      @if (loadError()) {
        <div class="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3 mb-4">{{ loadError() }}</div>
      }

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3 font-semibold">Usuario</th>
                <th class="px-4 py-3 font-semibold">Correo</th>
                <th class="px-4 py-3 font-semibold">Rol</th>
                <th class="px-4 py-3 font-semibold">Alta</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              @if (loading()) {
                <tr>
                  <td colspan="5" class="px-6 py-10 text-center text-sm text-slate-500">
                    <lucide-icon [img]="loaderIcon" [size]="18" class="inline animate-spin mr-2" />Cargando...
                  </td>
                </tr>
              } @else if (filtered().length === 0) {
                <tr><td colspan="5" class="px-6 py-10 text-center text-sm text-slate-500">Sin resultados.</td></tr>
              } @else {
                @for (p of filtered(); track p.id) {
                  <tr class="hover:bg-slate-50 transition">
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-[#1e3a8a] text-white text-xs font-semibold flex items-center justify-center">
                          {{ initials(p.full_name) }}
                        </div>
                        <div>
                          <div class="font-semibold text-slate-900">{{ p.full_name }}</div>
                          @if (p.id === auth.profile()?.id) {
                            <div class="text-[10px] text-blue-600 font-semibold">Tú</div>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-slate-600">{{ p.email }}</td>
                    <td class="px-4 py-3.5">
                      <span class="badge" [class]="roleBadge(p.role)">{{ roleLabel(p.role) }}</span>
                    </td>
                    <td class="px-4 py-3.5 text-slate-500 text-xs">{{ formatDate(p.created_at) }}</td>
                    <td class="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                        (click)="openEdit(p)"
                      >
                        <lucide-icon [img]="pencilIcon" [size]="14" />Editar
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (showCreate()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="closeCreate()">
        <div class="card w-full max-w-md p-5 fade-in-up" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
              <lucide-icon [img]="userPlusIcon" [size]="18" />Nuevo conductor
            </h3>
            <button type="button" class="p-1 rounded hover:bg-slate-100" (click)="closeCreate()">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>
          <form class="space-y-3" (ngSubmit)="submitCreate($event)">
            <div>
              <label class="input-label">Nombre completo</label>
              <input type="text" class="input" [(ngModel)]="createForm.full_name" name="createName" required />
            </div>
            <div>
              <label class="input-label">Correo</label>
              <input type="email" class="input" [(ngModel)]="createForm.email" name="createEmail" required />
            </div>
            <div>
              <label class="input-label">Contraseña temporal</label>
              <input type="password" class="input" [(ngModel)]="createForm.password" name="createPass" minlength="6" required />
            </div>
            <div>
              <label class="input-label">Rol</label>
              <select class="select" [(ngModel)]="createForm.role" name="createRole">
                <option value="conductor">Conductor</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            @if (formError()) {
              <p class="text-xs text-red-600">{{ formError() }}</p>
            }
            @if (formSuccess()) {
              <p class="text-xs text-emerald-600">{{ formSuccess() }}</p>
            }
            <button
              type="submit"
              class="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              [disabled]="creating()"
            >
              @if (creating()) { Creando... } @else { Crear cuenta }
            </button>
          </form>
        </div>
      </div>
    }

    @if (editing(); as profile) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="closeEdit()">
        <div class="card w-full max-w-md p-5 fade-in-up" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
              <lucide-icon [img]="shieldIcon" [size]="18" />Editar perfil
            </h3>
            <button type="button" class="p-1 rounded hover:bg-slate-100" (click)="closeEdit()">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>
          <form class="space-y-3" (ngSubmit)="submitEdit($event)">
            <div>
              <label class="input-label">Nombre completo</label>
              <input type="text" class="input" [(ngModel)]="editForm.full_name" name="editName" required />
            </div>
            <div>
              <label class="input-label">Correo</label>
              <input type="email" class="input bg-slate-50" [value]="profile.email" disabled />
            </div>
            <div>
              <label class="input-label">Rol</label>
              <select class="select" [(ngModel)]="editForm.role" name="editRole">
                <option value="conductor">Conductor</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            @if (formError()) {
              <p class="text-xs text-red-600">{{ formError() }}</p>
            }
            <button
              type="submit"
              class="w-full py-2.5 rounded-md bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              [disabled]="savingEdit()"
            >
              @if (savingEdit()) { Guardando... } @else { Guardar cambios }
            </button>
          </form>
        </div>
      </div>
    }
  `
})
export class EquipoPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesService);
  private readonly layout = inject(LayoutService);

  readonly plusIcon = Plus;
  readonly searchIcon = Search;
  readonly userIcon = User;
  readonly pencilIcon = Pencil;
  readonly loaderIcon = Loader2;
  readonly userPlusIcon = UserPlus;
  readonly closeIcon = X;
  readonly shieldIcon = Shield;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly list = signal<ProfileRow[]>([]);
  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly savingEdit = signal(false);
  readonly savingOwn = signal(false);
  readonly editing = signal<ProfileRow | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);

  busqueda = '';
  filtroRol: ProfileRole | 'todos' = 'todos';
  ownName = '';

  createForm: CreateDriverInput = {
    full_name: '',
    email: '',
    password: '',
    role: 'conductor'
  };

  editForm = { full_name: '', role: 'conductor' as ProfileRole };

  async ngOnInit(): Promise<void> {
    this.layout.setPage('Equipo', 'Conductores, supervisores y perfiles de usuario');
    await this.auth.refreshProfile();
    this.ownName = this.auth.profile()?.full_name ?? '';
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.list.set(await this.profiles.list());
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : 'Error al cargar perfiles');
    } finally {
      this.loading.set(false);
    }
  }

  filtered(): ProfileRow[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.list().filter((p) => {
      if (this.filtroRol !== 'todos' && p.role !== this.filtroRol) return false;
      if (!q) return true;
      return `${p.full_name} ${p.email}`.toLowerCase().includes(q);
    });
  }

  openCreate(): void {
    this.formError.set(null);
    this.formSuccess.set(null);
    this.createForm = { full_name: '', email: '', password: '', role: 'conductor' };
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
  }

  openEdit(p: ProfileRow): void {
    this.formError.set(null);
    this.editing.set(p);
    this.editForm = { full_name: p.full_name, role: p.role };
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  async submitCreate(e: Event): Promise<void> {
    e.preventDefault();
    this.creating.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    const result = await this.profiles.createDriver(this.createForm);
    this.creating.set(false);

    if (!result.ok) {
      this.formError.set(result.error ?? 'Error al crear');
      return;
    }

    this.formSuccess.set('Cuenta creada. El conductor ya puede iniciar sesión con su email y contraseña.');
    await this.load();
    setTimeout(() => this.closeCreate(), 1500);
  }

  async submitEdit(e: Event): Promise<void> {
    e.preventDefault();
    const p = this.editing();
    if (!p) return;

    this.savingEdit.set(true);
    this.formError.set(null);
    try {
      await this.profiles.update(p.id, {
        full_name: this.editForm.full_name,
        role: this.editForm.role
      });
      await this.load();
      this.closeEdit();
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      this.savingEdit.set(false);
    }
  }

  async saveOwnProfile(): Promise<void> {
    this.savingOwn.set(true);
    this.loadError.set(null);
    const result = await this.auth.updateOwnProfile(this.ownName);
    this.savingOwn.set(false);
    if (!result.ok) {
      this.loadError.set(result.error ?? 'Error al guardar perfil');
      return;
    }
    this.ownName = this.auth.profile()?.full_name ?? this.ownName;
    await this.load();
  }

  roleLabel(role: ProfileRole): string {
    if (role === 'admin') return 'Administrador';
    if (role === 'supervisor') return 'Supervisor';
    return 'Conductor';
  }

  roleBadge(role: ProfileRole): string {
    if (role === 'admin') return 'badge-danger';
    if (role === 'supervisor') return 'badge-warning';
    return 'badge-success';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
