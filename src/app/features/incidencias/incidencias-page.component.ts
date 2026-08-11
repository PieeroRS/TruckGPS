import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Image,
  Layers,
  LucideAngularModule,
  MapPin,
  MessageCircle,
  Mic,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Trash2,
  Truck,
  User,
  UserPlus,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { Incident, IncidentSeverity, IncidentStatus } from '../../core/models/incident.model';
import { IncidentFilters, IncidentService } from '../../core/services/incident.service';
import { LayoutService } from '../../core/services/layout.service';
import { formatDateTime, relativeTime } from '../../core/utils/map.utils';

const ESTADOS: IncidentStatus[] = ['reportado', 'asignado', 'en-atencion', 'resuelto'];
const ESTADO_LABEL: Record<IncidentStatus, string> = {
  reportado: 'Reportado',
  asignado: 'Asignado',
  'en-atencion': 'En atención',
  resuelto: 'Resuelto'
};

@Component({
  standalone: true,
  selector: 'app-incidencias-page',
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ ENCABEZADO ═══════════ -->
      <div class="flex items-end justify-between flex-wrap gap-4 mb-6 anim-in">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Gestión de incidencias</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Sigue el progreso de cada caso reportado en tu flota.</p>
        </div>
        <a routerLink="/reportar" class="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12.5px] font-semibold transition-all active:scale-[0.98] shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]">
          <lucide-icon [img]="plusIcon" [size]="14" class="transition-transform duration-300 group-hover:rotate-90" />
          Nueva incidencia
        </a>
      </div>
      
      <!-- ═══════════ KPIs ═══════════ -->
      <section class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
        @for (s of statsItems(); track s.label; let i = $index) {
          <div class="kpi group anim-in" [style.animation-delay.ms]="i * 55">
            <div class="flex items-start justify-between">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center ring-1 transition-transform duration-200 group-hover:scale-105"
                   [class]="s.iconCls">
                <lucide-icon [img]="s.icon" [size]="16" [strokeWidth]="2" />
              </div>
            </div>
            <div class="text-[26px] font-bold tracking-[-0.03em] leading-none mt-3 tnum" [class]="s.cls">{{ s.value }}</div>
            <div class="text-[11.5px] uppercase font-semibold tracking-wider text-slate-400 mt-1.5">{{ s.label }}</div>
          </div>
        }
      </section>

      <!-- ═══════════ FILTROS ═══════════ -->
      <section class="card p-4 sm:p-5 mb-5 anim-in" style="animation-delay: 120ms">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-6">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                class="input pl-9 pr-8"
                placeholder="Por placa, conductor, ID o ubicación..."
                [(ngModel)]="filters.busqueda"
                (ngModelChange)="onFilterChange()"
              />
              @if (filters.busqueda) {
                <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="clearSearch()" aria-label="Limpiar">
                  <lucide-icon [img]="closeIcon" [size]="12" />
                </button>
              }
            </div>
          </div>
          <div class="md:col-span-3">
            <label class="input-label">Estado</label>
            <select class="select" [(ngModel)]="filters.estado" (ngModelChange)="onFilterChange()">
              <option value="todos">Todos los estados</option>
              @for (e of ESTADOS; track e) {
                <option [value]="e">{{ ESTADO_LABEL[e] }}</option>
              }
            </select>
          </div>
          <div class="md:col-span-3">
            <label class="input-label">Severidad</label>
            <select class="select" [(ngModel)]="filters.severidad" (ngModelChange)="onFilterChange()">
              <option value="todas">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>

        @if (hasActiveFilters()) {
          <div class="flex items-center justify-between gap-3 mt-3.5 pt-3.5 border-t border-slate-100 expand-in">
            <span class="text-[12px] text-slate-500">Filtros aplicados</span>
            <button type="button" class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-md hover:bg-blue-50 transition" (click)="resetFilters()">
              <lucide-icon [img]="resetIcon" [size]="12" />Limpiar todo
            </button>
          </div>
        }
      </section>

      <div class="flex items-center justify-between gap-3 mb-4">
        <p class="text-[12.5px] text-slate-500">
          <span class="font-semibold text-slate-700 tnum">{{ filtered().length }}</span>
          incidencia{{ filtered().length === 1 ? '' : 's' }}
        </p>
      </div>

      <!-- ═══════════ LISTA ═══════════ -->
      <div class="space-y-3">
        @for (inc of filtered(); track inc.id; let i = $index) {
          <article class="card incident-card overflow-hidden anim-in" [class.is-open]="isOpen(inc.id)" [style.animation-delay.ms]="i * 45">

            <button type="button" class="w-full text-left p-4 sm:p-5 transition-colors hover:bg-slate-50/60" (click)="toggle(inc.id)">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap mb-2">
                    <span class="text-[11px] font-mono font-medium text-slate-400 px-1.5 py-0.5 rounded bg-slate-50 ring-1 ring-slate-200/70">{{ inc.id }}</span>
                    <span class="badge" [class]="estadoBadge(inc.estado)">{{ ESTADO_LABEL[inc.estado] }}</span>
                    <span class="badge inline-flex items-center gap-1" [class]="sevBadge(inc.severidad).cls">
                      <span class="w-1.5 h-1.5 rounded-full" [class]="sevDot(inc.severidad)"></span>
                      {{ sevBadge(inc.severidad).label }}
                    </span>
                    <span class="badge badge-neutral">{{ inc.categoria }}</span>
                  </div>

                  <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight leading-snug">{{ inc.titulo }}</h3>

                  <div class="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-2 text-[12px] text-slate-500">
                    <span class="flex items-center gap-1.5">
                      <lucide-icon [img]="truckIcon" [size]="12" class="text-slate-400 shrink-0" />
                      <strong class="font-mono font-semibold text-slate-700">{{ inc.placa }}</strong>
                      <span class="text-slate-300">·</span>{{ inc.conductor }}
                    </span>
                    <span class="flex items-center gap-1.5 min-w-0">
                      <lucide-icon [img]="mapPinIcon" [size]="12" class="text-slate-400 shrink-0" />
                      <span class="truncate">{{ inc.ubicacion }}</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                      <lucide-icon [img]="clockIcon" [size]="12" class="text-slate-400 shrink-0" />{{ relative(inc.creado) }}
                    </span>
                  </div>
                </div>

                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                     [class]="isOpen(inc.id) ? 'bg-blue-50 text-blue-600 rotate-180' : 'bg-slate-50 text-slate-400'">
                  <lucide-icon [img]="chevronDownIcon" [size]="16" />
                </div>
              </div>

              <!-- Track horizontal de progreso -->
              <div class="flex items-start mt-4 pt-4 border-t border-slate-100">
                @for (e of ESTADOS; track e; let si = $index) {
                  <div class="track-step flex flex-col items-center gap-1.5" [class.is-done]="si < stepIndex(inc)">
                    <div class="relative z-10 w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-300 ring-2 ring-white"
                         [class]="stepClass(inc, si)">
                      @if (si < stepIndex(inc)) {
                        <lucide-icon [img]="checkIcon" [size]="10" [strokeWidth]="3" class="text-white" />
                      }
                    </div>
                    <span class="text-[10.5px] font-medium text-center leading-tight px-1"
                          [class]="si <= stepIndex(inc) ? 'text-slate-700' : 'text-slate-400'">
                      {{ ESTADO_LABEL[e] }}
                    </span>
                  </div>
                }
              </div>
            </button>

            @if (isOpen(inc.id)) {
              <div class="px-4 sm:px-5 pb-5 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5 expand-in bg-slate-50/30">

                <div>
                  <h4 class="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2.5 flex items-center gap-1.5">
                    <lucide-icon [img]="fileIcon" [size]="11" />Descripción
                  </h4>
                  <p class="text-[13px] text-slate-600 leading-relaxed">{{ inc.descripcion }}</p>

                  <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
                    <div>
                      <div class="text-slate-400 mb-0.5">Reportado</div>
                      <div class="font-semibold text-slate-800 tnum">{{ fmtDt(inc.creado) }}</div>
                    </div>
                    <div>
                      <div class="text-slate-400 mb-0.5">Última actualización</div>
                      <div class="font-semibold text-slate-800 tnum">{{ fmtDt(inc.actualizado) }}</div>
                    </div>
                    <div>
                      <div class="text-slate-400 mb-0.5">Asignado a</div>
                      <div class="font-semibold flex items-center gap-1.5" [class]="inc.asignadoA ? 'text-slate-800' : 'text-slate-400'">
                        @if (inc.asignadoA) {
                          <lucide-icon [img]="userIcon" [size]="11" class="text-slate-400" />
                        }
                        {{ inc.asignadoA || 'Sin asignar' }}
                      </div>
                    </div>
                    <div>
                      <div class="text-slate-400 mb-0.5">Adjuntos</div>
                      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        @if (inc.foto) {
                          <span class="badge badge-info flex items-center gap-1"><lucide-icon [img]="imageIcon" [size]="10" />Foto</span>
                        }
                        @if (inc.audio) {
                          <span class="badge badge-info flex items-center gap-1"><lucide-icon [img]="micIcon" [size]="10" />Audio</span>
                        }
                        @if (!inc.foto && !inc.audio) {
                          <span class="text-slate-400">—</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  @if (auth.isStaff()) {
                    <h4 class="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2.5 flex items-center gap-1.5">
                      <lucide-icon [img]="layersIcon" [size]="11" />Acciones
                    </h4>

                    <div class="p-3.5 rounded-xl bg-white ring-1 ring-slate-200/80 space-y-3">
                      <div>
                        <label class="input-label">Cambiar estado</label>
                        <select class="select text-[12.5px] py-2" [ngModel]="inc.estado" (ngModelChange)="changeStatus(inc.id, $event)">
                          @for (e of ESTADOS; track e) {
                            <option [value]="e">{{ ESTADO_LABEL[e] }}</option>
                          }
                        </select>
                      </div>

                      <div class="grid grid-cols-2 gap-2">
                        <button type="button" class="px-3 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12px] font-semibold transition active:scale-[0.98] flex items-center justify-center gap-1.5" (click)="openAssign(inc.id)">
                          <lucide-icon [img]="userPlusIcon" [size]="12" />Asignar
                        </button>
                        <button type="button" class="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50 transition active:scale-[0.98] flex items-center justify-center gap-1.5" (click)="openComment(inc.id)">
                          <lucide-icon [img]="messageIcon" [size]="12" />Comentar
                        </button>
                      </div>

                      <button type="button" class="w-full px-3 py-2 rounded-lg ring-1 ring-red-200 bg-red-50/60 text-red-600 text-[12px] font-semibold hover:bg-red-100 hover:ring-red-300 transition active:scale-[0.98] flex items-center justify-center gap-1.5" (click)="remove(inc)">
                        <lucide-icon [img]="trashIcon" [size]="12" />Eliminar incidencia
                      </button>
                    </div>
                  } @else {
                    <div class="h-full flex flex-col items-center justify-center text-center py-8 rounded-xl bg-white ring-1 ring-slate-200/70">
                      <div class="w-10 h-10 rounded-xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mb-2.5">
                        <lucide-icon [img]="alertIcon" [size]="17" class="text-slate-300" />
                      </div>
                      <p class="text-[12.5px] font-medium text-slate-600">Solo lectura</p>
                      <p class="text-[11.5px] text-slate-400 mt-1 px-6">Necesitas permisos de supervisor para gestionar este caso.</p>
                    </div>
                  }
                </div>
              </div>
            }
          </article>
        } @empty {
          <div class="card p-14 text-center anim-in">
            <div class="w-14 h-14 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mx-auto mb-4">
              <lucide-icon [img]="searchXIcon" [size]="22" class="text-slate-300" />
            </div>
            <p class="text-[14px] font-semibold text-slate-700">Sin incidencias</p>
            <p class="text-[12.5px] text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
              No se encontraron casos con los filtros actuales.
            </p>
            @if (hasActiveFilters()) {
              <button type="button" class="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition" (click)="resetFilters()">
                <lucide-icon [img]="resetIcon" [size]="13" />Limpiar filtros
              </button>
            }
          </div>
        }
      </div>
    </div>

    <!-- ═══════════ TOAST ═══════════ -->
    @if (actionError()) {
      <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 toast-in
                  flex items-start gap-2.5 max-w-sm px-4 py-3 rounded-xl
                  bg-white ring-1 ring-red-200 shadow-lg shadow-red-900/5">
        <lucide-icon [img]="alertCircleIcon" [size]="15" class="text-red-500 mt-0.5 shrink-0" />
        <p class="text-[12.5px] text-red-700 leading-snug flex-1">{{ actionError() }}</p>
        <button type="button" class="shrink-0 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="actionError.set(null)" aria-label="Cerrar">
          <lucide-icon [img]="closeIcon" [size]="12" />
        </button>
      </div>
    }

    <!-- ═══════════ MODAL ASIGNAR ═══════════ -->
    @if (assignModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="assignModal.set(null)">
        <div class="card w-full max-w-sm p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center">
                <lucide-icon [img]="userPlusIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">Asignar técnico</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5 font-mono">{{ assignModal() }}</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="assignModal.set(null)" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <label class="input-label">Nombre del técnico</label>
          <input class="input mb-4" placeholder="Ej. Carlos Mendoza" [(ngModel)]="assignName" />

          <div class="flex gap-2.5">
            <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="assignModal.set(null)">
              Cancelar
            </button>
            <button
              type="button"
              class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold
                     transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
              [disabled]="actionLoading() || !assignName.trim()"
              (click)="confirmAssign()"
            >
              {{ actionLoading() ? 'Guardando...' : 'Asignar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ═══════════ MODAL COMENTARIO ═══════════ -->
    @if (commentModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="commentModal.set(null)">
        <div class="card w-full max-w-sm p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center">
                <lucide-icon [img]="messageIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">Agregar comentario</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5 font-mono">{{ commentModal() }}</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="commentModal.set(null)" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <label class="input-label">Nota interna</label>
          <textarea class="textarea mb-1.5" rows="4" placeholder="Detalles del seguimiento..." [(ngModel)]="commentText"></textarea>
          <p class="text-[11px] text-slate-400 mb-4">Visible solo para el equipo de operaciones.</p>

          <div class="flex gap-2.5">
            <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="commentModal.set(null)">
              Cancelar
            </button>
            <button
              type="button"
              class="flex-[1.4] py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold
                     transition active:scale-[0.99] shadow-sm shadow-violet-600/25 disabled:opacity-50 disabled:active:scale-100"
              [disabled]="actionLoading() || !commentText.trim()"
              (click)="confirmComment()"
            >
              {{ actionLoading() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class IncidenciasPageComponent implements OnInit {
  private readonly incidents = inject(IncidentService);
  private readonly layout = inject(LayoutService);
  readonly auth = inject(AuthService);

  readonly ESTADO_LABEL = ESTADO_LABEL;
  readonly ESTADOS = ESTADOS;

  readonly plusIcon = Plus;
  readonly searchIcon = Search;
  readonly searchXIcon = SearchX;
  readonly truckIcon = Truck;
  readonly mapPinIcon = MapPin;
  readonly clockIcon = Clock;
  readonly chevronUpIcon = ChevronUp;
  readonly chevronDownIcon = ChevronDown;
  readonly imageIcon = Image;
  readonly micIcon = Mic;
  readonly userPlusIcon = UserPlus;
  readonly messageIcon = MessageCircle;
  readonly trashIcon = Trash2;
  readonly closeIcon = X;
  readonly checkIcon = Check;
  readonly userIcon = User;
  readonly fileIcon = FileText;
  readonly layersIcon = Layers;
  readonly resetIcon = RotateCcw;
  readonly alertIcon = AlertTriangle;
  readonly alertCircleIcon = AlertCircle;

  filters: IncidentFilters = { estado: 'todos', severidad: 'todas', busqueda: '' };
  readonly filteredList = signal<Incident[]>([]);
  private readonly expanded = signal(new Set<string>());
  readonly assignModal = signal<string | null>(null);
  readonly commentModal = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly actionError = signal<string | null>(null);
  assignName = '';
  commentText = '';

  ngOnInit(): void {
    this.layout.setPage('Incidencias', 'Gestión y seguimiento de casos reportados');
    void this.incidents.load().then(() => this.refresh());
  }

  filtered(): Incident[] {
    return this.filteredList();
  }

  statsItems() {
    const stats = this.incidents.getStats();
    return [
      { label: 'Total', value: stats.total, cls: 'text-slate-900', icon: Layers, iconCls: 'bg-slate-100 text-slate-600 ring-slate-200' },
      { label: 'Reportadas', value: stats['reportado'] || 0, cls: 'text-slate-700', icon: FileText, iconCls: 'bg-blue-50 text-blue-600 ring-blue-100' },
      { label: 'En atención', value: (stats['en-atencion'] || 0) + (stats['asignado'] || 0), cls: 'text-amber-600', icon: Clock, iconCls: 'bg-amber-50 text-amber-600 ring-amber-100' },
      { label: 'Resueltas', value: stats['resuelto'] || 0, cls: 'text-emerald-600', icon: CheckCircle2, iconCls: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
      { label: 'Severidad alta', value: stats.altaSev, cls: 'text-red-600', icon: AlertTriangle, iconCls: 'bg-red-50 text-red-600 ring-red-100' }
    ];
  }

  hasActiveFilters(): boolean {
    return (
      this.filters.estado !== 'todos' ||
      this.filters.severidad !== 'todas' ||
      !!this.filters.busqueda?.trim()
    );
  }

  clearSearch(): void {
    this.filters.busqueda = '';
    this.refresh();
  }

  resetFilters(): void {
    this.filters = { estado: 'todos', severidad: 'todas', busqueda: '' };
    this.refresh();
  }

  onFilterChange(): void {
    this.refresh();
  }

  toggle(id: string): void {
    const set = new Set(this.expanded());
    set.has(id) ? set.delete(id) : set.add(id);
    this.expanded.set(set);
  }

  isOpen(id: string): boolean {
    return this.expanded().has(id);
  }

  sevBadge(s: IncidentSeverity) {
    return ({
      high: { cls: 'badge-danger', label: 'Alta' },
      medium: { cls: 'badge-warning', label: 'Media' },
      low: { cls: 'badge-success', label: 'Baja' }
    } as const)[s];
  }

  sevDot(s: IncidentSeverity): string {
    return ({ high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' } as const)[s];
  }

  estadoBadge(e: IncidentStatus): string {
    return ({
      reportado: 'badge-neutral',
      asignado: 'badge-info',
      'en-atencion': 'badge-warning',
      resuelto: 'badge-success'
    } as const)[e];
  }

  stepIndex(inc: Incident): number {
    return ESTADOS.indexOf(inc.estado);
  }

  stepClass(inc: Incident, i: number): string {
    const current = this.stepIndex(inc);
    if (i < current) return 'bg-emerald-500';
    if (i === current) return 'bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.18)]';
    return 'bg-white ring-1 ring-slate-300';
  }

  timelineClass(inc: Incident, i: number): string {
    const currentIdx = ESTADOS.indexOf(inc.estado);
    if (i < currentIdx) return 'is-done';
    if (i === currentIdx) return 'is-active';
    return '';
  }

  timelineStatus(inc: Incident, i: number): string {
    const currentIdx = ESTADOS.indexOf(inc.estado);
    if (i < currentIdx) return 'Completado';
    if (i === currentIdx) return 'En curso';
    return 'Pendiente';
  }

  relative(iso: string): string {
    return relativeTime(iso);
  }

  fmtDt(iso: string): string {
    return formatDateTime(iso);
  }

  private refresh(): void {
    this.filteredList.set(this.incidents.filter(this.filters));
  }

  private showError(msg: string): void {
    this.actionError.set(msg);
    setTimeout(() => this.actionError.set(null), 5000);
  }

  openAssign(id: string): void {
    this.assignName = '';
    this.actionError.set(null);
    this.assignModal.set(id);
  }

  openComment(id: string): void {
    this.commentText = '';
    this.actionError.set(null);
    this.commentModal.set(id);
  }

  async confirmAssign(): Promise<void> {
    const id = this.assignModal();
    if (!id || !this.assignName.trim()) return;
    this.actionLoading.set(true);
    const r = await this.incidents.assign(id, this.assignName);
    this.actionLoading.set(false);
    if (!r.ok) {
      this.showError(r.error ?? 'Error');
      return;
    }
    this.assignModal.set(null);
    this.refresh();
  }

  async confirmComment(): Promise<void> {
    const id = this.commentModal();
    if (!id || !this.commentText.trim()) return;
    this.actionLoading.set(true);
    const r = await this.incidents.addComment(id, this.commentText);
    this.actionLoading.set(false);
    if (!r.ok) {
      this.showError(r.error ?? 'Error');
      return;
    }
    this.commentModal.set(null);
    this.refresh();
  }

  async changeStatus(id: string, estado: IncidentStatus): Promise<void> {
    this.actionLoading.set(true);
    const r = await this.incidents.updateStatus(id, estado);
    this.actionLoading.set(false);
    if (!r.ok) this.showError(r.error ?? 'Error');
    else this.refresh();
  }

  async remove(inc: Incident): Promise<void> {
    if (!confirm(`¿Eliminar incidencia ${inc.id}?`)) return;
    const r = await this.incidents.delete(inc.id);
    if (!r.ok) this.showError(r.error ?? 'Error');
    else this.refresh();
  }
}