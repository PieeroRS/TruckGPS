import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  Check,
  Loader2,
  LucideAngularModule,
  Mail,
  Pencil,
  Plus,
  Search,
  Shield,
  User,
  UserPlus,
  Users,
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
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ ENCABEZADO ═══════════ -->
      <div class="flex items-end justify-between flex-wrap gap-4 mb-6 anim-in">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Equipo y conductores</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Administra perfiles, roles y altas de conductores.</p>
        </div>
        @if (auth.isStaff()) {
          <button type="button" class="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12.5px] font-semibold transition-all active:scale-[0.98] shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]" (click)="openCreate()">
            <lucide-icon [img]="plusIcon" [size]="14" class="transition-transform duration-300 group-hover:rotate-90" />Agregar conductor
          </button>
        }
      </div>

      <!-- ═══════════ RESUMEN ═══════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        @for (s of summary(); track s.label; let i = $index) {
          <div class="kpi group anim-in" [style.animation-delay.ms]="i * 55">
            <div class="flex items-start justify-between">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center ring-1 transition-transform duration-200 group-hover:scale-105" [class]="s.iconCls">
                <lucide-icon [img]="s.icon" [size]="16" [strokeWidth]="2" />
              </div>
            </div>
            <div class="text-[26px] font-bold tracking-[-0.03em] leading-none mt-3 tnum" [class]="s.cls">{{ s.value }}</div>
            <div class="text-[11.5px] uppercase font-semibold tracking-wider text-slate-400 mt-1.5">{{ s.label }}</div>
          </div>
        }
      </section>

      <!-- ═══════════ MI PERFIL ═══════════ -->
      <div class="card p-5 mb-5 anim-in" style="animation-delay: 110ms">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-11 h-11 rounded-xl bg-[#0b1220] text-white flex items-center justify-center shrink-0">
            <span class="text-[14px] font-bold tracking-tight">{{ auth.initials() }}</span>
          </div>
          <div class="min-w-0">
            <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Mi perfil</h3>
            <p class="text-[12px] text-slate-500 mt-0.5 truncate">
              {{ auth.roleLabel() }} · {{ auth.profile()?.email || '—' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div class="md:col-span-5">
            <label class="input-label">Nombre completo</label>
            <input type="text" class="input" [(ngModel)]="ownName" name="ownName" placeholder="Tu nombre y apellido" />
          </div>
          <div class="md:col-span-4">
            <label class="input-label flex items-center gap-1.5">
              <lucide-icon [img]="mailIcon" [size]="12" class="text-slate-400" />Correo
            </label>
            <input type="email" class="input bg-slate-50 text-slate-500" [value]="auth.profile()?.email ?? ''" disabled />
          </div>
          <div class="md:col-span-3">
            <button type="button" class="w-full px-3 py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12.5px] font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-1.5" [disabled]="savingOwn() || !ownDirty()" (click)="saveOwnProfile()">
              @if (savingOwn()) {
                <lucide-icon [img]="loaderIcon" [size]="13" class="animate-spin" />Guardando...
              } @else {
                Guardar mi perfil
              }
            </button>
          </div>
        </div>

        @if (ownSuccess()) {
          <div class="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 msg-in">
            <lucide-icon [img]="checkIcon" [size]="13" class="shrink-0" />
            <p class="text-[12px]">{{ ownSuccess() }}</p>
          </div>
        }
      </div>

      <!-- ═══════════ FILTROS ═══════════ -->
      <div class="card p-4 mb-5 anim-in" style="animation-delay: 170ms">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-8">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" class="input pl-9 pr-8" placeholder="Nombre o correo..." [(ngModel)]="busqueda" />
              @if (busqueda) {
                <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="busqueda = ''" aria-label="Limpiar">
                  <lucide-icon [img]="closeIcon" [size]="12" />
                </button>
              }
            </div>
          </div>
          <div class="md:col-span-4">
            <label class="input-label">Rol</label>
            <select class="select" [(ngModel)]="filtroRol">
              <option value="todos">Todos ({{ countRole('todos') }})</option>
              <option value="conductor">Conductores ({{ countRole('conductor') }})</option>
              <option value="supervisor">Supervisores ({{ countRole('supervisor') }})</option>
              <option value="admin">Administradores ({{ countRole('admin') }})</option>
            </select>
          </div>
        </div>
      </div>

      @if (loadError()) {
        <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 mb-4 msg-in">
          <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
          <p class="text-[12.5px] leading-snug flex-1">{{ loadError() }}</p>
          <button type="button" class="shrink-0 w-5 h-5 rounded-md text-red-400 hover:text-red-700 hover:bg-red-100 flex items-center justify-center transition" (click)="loadError.set(null)" aria-label="Cerrar">
            <lucide-icon [img]="closeIcon" [size]="12" />
          </button>
        </div>
      }

      <!-- ═══════════ TABLA ═══════════ -->
      <div class="card overflow-hidden anim-in" style="animation-delay: 230ms">
        <div class="px-5 py-3.5 border-b border-slate-200/80">
          <p class="text-[12.5px] text-slate-500">
            <span class="font-semibold text-slate-700 tnum">{{ filtered().length }}</span>
            {{ filtered().length === 1 ? 'miembro' : 'miembros' }}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50/70 border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th class="px-4 py-3 font-semibold">Usuario</th>
                <th class="px-4 py-3 font-semibold">Correo</th>
                <th class="px-4 py-3 font-semibold">Rol</th>
                <th class="px-4 py-3 font-semibold">Alta</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-[13px]">
              @if (loading()) {
                @for (n of [1, 2, 3, 4]; track n) {
                  <tr>
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
                        <div class="h-3.5 w-32 rounded bg-slate-100 animate-pulse"></div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5"><div class="h-3.5 w-40 rounded bg-slate-100 animate-pulse"></div></td>
                    <td class="px-4 py-3.5"><div class="h-5 w-20 rounded-full bg-slate-100 animate-pulse"></div></td>
                    <td class="px-4 py-3.5"><div class="h-3.5 w-24 rounded bg-slate-100 animate-pulse"></div></td>
                    <td class="px-4 py-3.5"><div class="h-3.5 w-14 rounded bg-slate-100 animate-pulse ml-auto"></div></td>
                  </tr>
                }
              } @else {
                @for (p of filtered(); track p.id; let i = $index) {
                  <tr class="team-row row-slide hover:bg-slate-50/70" [class.is-me]="p.id === auth.profile()?.id" [class.bg-blue-50/30]="p.id === auth.profile()?.id" [style.animation-delay.ms]="i * 35">
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full text-white text-[11.5px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm" [class]="avatarBg(p.role)">
                          {{ initials(p.full_name) }}
                        </div>
                        <div class="min-w-0">
                          <div class="font-semibold text-slate-900 tracking-tight truncate">{{ p.full_name }}</div>
                          @if (p.id === auth.profile()?.id) {
                            <div class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">
                              <span class="w-1 h-1 rounded-full bg-blue-500"></span>Tú
                            </div>
                          }
                        </div>
                      </div>
                    </td>

                    <td class="px-4 py-3.5">
                      <span class="text-slate-500 truncate block max-w-[220px]">{{ p.email }}</span>
                    </td>

                    <td class="px-4 py-3.5">
                      <span class="badge inline-flex items-center gap-1.5" [class]="roleBadge(p.role)">
                        <span class="w-1.5 h-1.5 rounded-full" [class]="roleDot(p.role)"></span>
                        {{ roleLabel(p.role) }}
                      </span>
                    </td>

                    <td class="px-4 py-3.5 text-slate-400 text-[12px] tnum">{{ formatDate(p.created_at) }}</td>

                    <td class="px-4 py-3.5 text-right">
                      @if (auth.isStaff()) {
                        <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition active:scale-95" (click)="openEdit(p)">
                          <lucide-icon [img]="pencilIcon" [size]="11" />Editar
                        </button>
                      } @else {
                        <span class="text-[11.5px] text-slate-300">—</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-6 py-16 text-center">
                      <div class="w-14 h-14 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mx-auto mb-4">
                        <lucide-icon [img]="usersIcon" [size]="22" class="text-slate-300" />
                      </div>
                      <p class="text-[14px] font-semibold text-slate-700">Sin resultados</p>
                      <p class="text-[12.5px] text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                        {{ busqueda || filtroRol !== 'todos' ? 'Ningún miembro coincide con los filtros.' : 'Aún no hay perfiles registrados.' }}
                      </p>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════ MODAL CREAR ═══════════ -->
    @if (showCreate()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="closeCreate()">
        <div class="card w-full max-w-md p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center">
                <lucide-icon [img]="userPlusIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">Nuevo conductor</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5">Se creará una cuenta de acceso.</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="closeCreate()" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <form class="space-y-4" (ngSubmit)="submitCreate($event)">
            <div>
              <label class="input-label">Nombre completo</label>
              <input type="text" class="input" [(ngModel)]="createForm.full_name" name="createName" placeholder="Carlos Mendoza" required />
            </div>
            <div>
              <label class="input-label">Correo</label>
              <input type="email" class="input" [(ngModel)]="createForm.email" name="createEmail" placeholder="carlos@truckgps.pe" required />
            </div>
            <div>
              <label class="input-label">Contraseña temporal</label>
              <input type="password" class="input" [(ngModel)]="createForm.password" name="createPass" placeholder="Mínimo 6 caracteres" minlength="6" required />
              <p class="text-[11px] text-slate-400 mt-1.5">El conductor podrá cambiarla desde su perfil.</p>
            </div>
            <div>
              <label class="input-label">Rol</label>
              <div class="grid grid-cols-3 gap-2">
                @for (r of roleOpts; track r.value) {
                  <button type="button" (click)="createForm.role = r.value" class="py-2 rounded-lg text-[12px] font-semibold ring-1 transition active:scale-95" [class]="createForm.role === r.value ? r.active : 'ring-slate-200 text-slate-500 hover:bg-slate-50'">
                    {{ r.label }}
                  </button>
                }
              </div>
            </div>

            @if (formError()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in">
                <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
                <p class="text-[12.5px] leading-snug">{{ formError() }}</p>
              </div>
            }
            @if (formSuccess()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 msg-in">
                <lucide-icon [img]="checkIcon" [size]="14" class="mt-0.5 shrink-0 check-pop" />
                <p class="text-[12.5px] leading-snug">{{ formSuccess() }}</p>
              </div>
            }

            <div class="flex gap-2.5 pt-1">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="closeCreate()">
                Cancelar
              </button>
              <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100" [disabled]="creating()">
                @if (creating()) {
                  <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" />Creando...
                } @else {
                  Crear cuenta
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ═══════════ MODAL EDITAR ═══════════ -->
    @if (editing(); as profile) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="closeEdit()">
        <div class="card w-full max-w-md p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-full text-white text-[13px] font-bold flex items-center justify-center shrink-0" [class]="avatarBg(profile.role)">
                {{ initials(profile.full_name) }}
              </div>
              <div class="min-w-0">
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight truncate">Editar perfil</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5 truncate">{{ profile.email }}</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="closeEdit()" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <form class="space-y-4" (ngSubmit)="submitEdit($event)">
            <div>
              <label class="input-label">Nombre completo</label>
              <input type="text" class="input" [(ngModel)]="editForm.full_name" name="editName" required />
            </div>
            <div>
              <label class="input-label flex items-center gap-1.5">
                <lucide-icon [img]="mailIcon" [size]="12" class="text-slate-400" />Correo
              </label>
              <input type="email" class="input bg-slate-50 text-slate-500" [value]="profile.email" disabled />
              <p class="text-[11px] text-slate-400 mt-1.5">El correo no se puede modificar.</p>
            </div>
            <div>
              <label class="input-label flex items-center gap-1.5">
                <lucide-icon [img]="shieldIcon" [size]="12" class="text-slate-400" />Rol
              </label>
              <div class="grid grid-cols-3 gap-2">
                @for (r of roleOpts; track r.value) {
                  <button type="button" (click)="editForm.role = r.value" class="py-2 rounded-lg text-[12px] font-semibold ring-1 transition active:scale-95" [class]="editForm.role === r.value ? r.active : 'ring-slate-200 text-slate-500 hover:bg-slate-50'">
                    {{ r.label }}
                  </button>
                }
              </div>
              @if (profile.id === auth.profile()?.id && editForm.role !== profile.role) {
                <p class="text-[11px] text-amber-600 mt-2 flex items-center gap-1.5 msg-in">
                  <lucide-icon [img]="alertIcon" [size]="11" class="shrink-0" />
                  Estás cambiando tu propio rol. Podrías perder accesos.
                </p>
              }
            </div>

            @if (formError()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in">
                <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
                <p class="text-[12.5px] leading-snug">{{ formError() }}</p>
              </div>
            }

            <div class="flex gap-2.5 pt-1">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="closeEdit()">
                Cancelar
              </button>
              <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100" [disabled]="savingEdit()">
                @if (savingEdit()) {
                  <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" />Guardando...
                } @else {
                  Guardar cambios
                }
              </button>
            </div>
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
  readonly mailIcon = Mail;
  readonly checkIcon = Check;
  readonly alertIcon = AlertCircle;
  readonly usersIcon = Users;

  readonly roleOpts = [
    { value: 'conductor' as ProfileRole, label: 'Conductor', active: 'ring-emerald-300 bg-emerald-50 text-emerald-700' },
    { value: 'supervisor' as ProfileRole, label: 'Supervisor', active: 'ring-amber-300 bg-amber-50 text-amber-700' },
    { value: 'admin' as ProfileRole, label: 'Admin', active: 'ring-red-300 bg-red-50 text-red-700' }
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly list = signal<ProfileRow[]>([]);
  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly savingEdit = signal(false);
  readonly savingOwn = signal(false);
  readonly ownSuccess = signal<string | null>(null);
  readonly editing = signal<ProfileRow | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);

  busqueda = '';
  filtroRol: ProfileRole | 'todos' = 'todos';
  ownName = '';
  private originalOwnName = '';

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
    this.originalOwnName = this.ownName;
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

  ownDirty(): boolean {
    return this.ownName.trim() !== this.originalOwnName.trim() && this.ownName.trim().length > 0;
  }

  countRole(role: ProfileRole | 'todos'): number {
    const all = this.list();
    return role === 'todos' ? all.length : all.filter((p) => p.role === role).length;
  }

  summary() {
    return [
      { label: 'Total equipo', value: this.countRole('todos'), cls: 'text-slate-900', icon: Users, iconCls: 'bg-slate-100 text-slate-600 ring-slate-200' },
      { label: 'Conductores', value: this.countRole('conductor'), cls: 'text-emerald-600', icon: User, iconCls: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
      { label: 'Supervisores', value: this.countRole('supervisor'), cls: 'text-amber-600', icon: Shield, iconCls: 'bg-amber-50 text-amber-600 ring-amber-100' },
      { label: 'Administradores', value: this.countRole('admin'), cls: 'text-red-600', icon: Shield, iconCls: 'bg-red-50 text-red-600 ring-red-100' }
    ];
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
    this.ownSuccess.set(null);
    const result = await this.auth.updateOwnProfile(this.ownName);
    this.savingOwn.set(false);
    if (!result.ok) {
      this.loadError.set(result.error ?? 'Error al guardar perfil');
      return;
    }
    this.ownName = this.auth.profile()?.full_name ?? this.ownName;
    this.originalOwnName = this.ownName;
    this.ownSuccess.set('Perfil actualizado correctamente.');
    setTimeout(() => this.ownSuccess.set(null), 3500);
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

  roleDot(role: ProfileRole): string {
    if (role === 'admin') return 'bg-red-500';
    if (role === 'supervisor') return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  avatarBg(role: ProfileRole): string {
    if (role === 'admin') return 'bg-gradient-to-br from-red-500 to-red-700';
    if (role === 'supervisor') return 'bg-gradient-to-br from-amber-500 to-amber-700';
    return 'bg-gradient-to-br from-blue-600 to-blue-800';
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
