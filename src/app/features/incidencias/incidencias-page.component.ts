import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Image,
  LucideAngularModule,
  MapPin,
  MessageCircle,
  Mic,
  Plus,
  Search,
  SearchX,
  Trash2,
  Truck,
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
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Gestión de incidencias</h2>
          <p class="text-xs text-slate-500 mt-1">Sigue el progreso de cada caso reportado en tu flota.</p>
        </div>
        <a routerLink="/reportar" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition">
          <lucide-icon [img]="plusIcon" [size]="14" />
          Nueva incidencia
        </a>
      </div>

      <section class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
        @for (s of statsItems(); track s.label) {
          <div class="kpi">
            <div class="text-[11px] uppercase font-semibold tracking-wider text-slate-500">{{ s.label }}</div>
            <div class="text-2xl font-bold" [class]="s.cls">{{ s.value }}</div>
          </div>
        }
      </section>

      <section class="card p-4 sm:p-5 mb-5">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-5">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" class="input pl-9" placeholder="Por placa, conductor, ID o ubicación..." [(ngModel)]="filters.busqueda" (ngModelChange)="onFilterChange()" />
            </div>
          </div>
          <div class="md:col-span-3">
            <label class="input-label">Estado</label>
            <select class="select" [(ngModel)]="filters.estado" (ngModelChange)="onFilterChange()">
              <option value="todos">Todos los estados</option>
              <option value="reportado">Reportado</option>
              <option value="asignado">Asignado</option>
              <option value="en-atencion">En atención</option>
              <option value="resuelto">Resuelto</option>
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
      </section>

      <div class="flex items-center justify-between mb-4">
        <p class="text-xs text-slate-500">{{ filtered().length }} incidencia{{ filtered().length === 1 ? '' : 's' }}</p>
      </div>

      <div class="space-y-4">
        @if (filtered().length === 0) {
          <div class="card p-12 text-center">
            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <lucide-icon [img]="searchXIcon" [size]="20" />
            </div>
            <p class="text-sm text-slate-600">No se encontraron incidencias con esos filtros.</p>
          </div>
        }
        @for (inc of filtered(); track inc.id) {
          <article class="card overflow-hidden fade-in-up">
            <button type="button" class="w-full text-left p-4 sm:p-5 hover:bg-slate-50 transition" (click)="toggle(inc.id)">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1.5">
                    <span class="text-[11px] font-mono text-slate-500">{{ inc.id }}</span>
                    <span class="badge" [class]="estadoBadge(inc.estado)">{{ ESTADO_LABEL[inc.estado] }}</span>
                    <span class="badge" [class]="sevBadge(inc.severidad).cls">{{ sevBadge(inc.severidad).label }}</span>
                    <span class="badge badge-neutral">{{ inc.categoria }}</span>
                  </div>
                  <h3 class="text-sm sm:text-base font-semibold text-slate-900">{{ inc.titulo }}</h3>
                  <div class="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-slate-500">
                    <span class="flex items-center gap-1">
                      <lucide-icon [img]="truckIcon" [size]="12" />
                      <strong class="text-slate-700">{{ inc.placa }}</strong> · {{ inc.conductor }}
                    </span>
                    <span class="flex items-center gap-1">
                      <lucide-icon [img]="mapPinIcon" [size]="12" />{{ inc.ubicacion }}
                    </span>
                    <span class="flex items-center gap-1">
                      <lucide-icon [img]="clockIcon" [size]="12" />{{ relative(inc.creado) }}
                    </span>
                  </div>
                </div>
                <lucide-icon [img]="isOpen(inc.id) ? chevronUpIcon : chevronDownIcon" [size]="18" class="text-slate-400 mt-1" />
              </div>
            </button>

            @if (isOpen(inc.id)) {
              <div class="px-4 sm:px-5 pb-5 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Descripción</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">{{ inc.descripcion }}</p>
                  <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><div class="text-slate-500 mb-0.5">Reportado</div><div class="font-semibold text-slate-800">{{ fmtDt(inc.creado) }}</div></div>
                    <div><div class="text-slate-500 mb-0.5">Última actualización</div><div class="font-semibold text-slate-800">{{ fmtDt(inc.actualizado) }}</div></div>
                    <div><div class="text-slate-500 mb-0.5">Asignado a</div><div class="font-semibold text-slate-800">{{ inc.asignadoA || 'Sin asignar' }}</div></div>
                    <div>
                      <div class="text-slate-500 mb-0.5">Adjuntos</div>
                      <div class="flex items-center gap-2 mt-0.5">
                        @if (inc.foto) { <span class="badge badge-info flex items-center gap-1"><lucide-icon [img]="imageIcon" [size]="11" />Foto</span> }
                        @if (inc.audio) { <span class="badge badge-info flex items-center gap-1"><lucide-icon [img]="micIcon" [size]="11" />Audio</span> }
                        @if (!inc.foto && !inc.audio) { <span class="text-slate-400">—</span> }
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 mt-4 flex-wrap">
                    @if (auth.isStaff()) {
                      <select class="select text-xs py-1.5 w-auto" [ngModel]="inc.estado" (ngModelChange)="changeStatus(inc.id, $event)">
                        @for (e of ESTADOS; track e) {
                          <option [value]="e">{{ ESTADO_LABEL[e] }}</option>
                        }
                      </select>
                      <button type="button" class="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1.5" (click)="openAssign(inc.id)">
                        <lucide-icon [img]="userPlusIcon" [size]="13" />Asignar técnico
                      </button>
                      <button type="button" class="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5" (click)="openComment(inc.id)">
                        <lucide-icon [img]="messageIcon" [size]="13" />Comentar
                      </button>
                      <button type="button" class="px-3 py-1.5 rounded-md border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 transition flex items-center gap-1.5" (click)="remove(inc)">
                        <lucide-icon [img]="trashIcon" [size]="13" />Eliminar
                      </button>
                    }
                  </div>
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Progreso</h4>
                  <ol class="timeline mt-3 ml-1">
                    @for (e of ESTADOS; track e; let i = $index) {
                      <li class="timeline-step" [class]="timelineClass(inc, i)">
                        <div class="text-xs font-semibold text-slate-900">{{ ESTADO_LABEL[e] }}</div>
                        <div class="text-[11px] text-slate-500">{{ timelineStatus(inc, i) }}</div>
                      </li>
                    }
                  </ol>
                </div>
              </div>
            }
          </article>
        }
      </div>
    </div>

    @if (actionError()) {
      <p class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 shadow">{{ actionError() }}</p>
    }

    @if (assignModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="assignModal.set(null)">
        <div class="card w-full max-w-sm p-5" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold">Asignar técnico</h3>
            <button type="button" (click)="assignModal.set(null)"><lucide-icon [img]="closeIcon" [size]="18" /></button>
          </div>
          <input class="input mb-3" placeholder="Nombre del técnico" [(ngModel)]="assignName" />
          <button type="button" class="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold" [disabled]="actionLoading()" (click)="confirmAssign()">
            {{ actionLoading() ? 'Guardando...' : 'Asignar' }}
          </button>
        </div>
      </div>
    }

    @if (commentModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="commentModal.set(null)">
        <div class="card w-full max-w-sm p-5" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold">Agregar comentario</h3>
            <button type="button" (click)="commentModal.set(null)"><lucide-icon [img]="closeIcon" [size]="18" /></button>
          </div>
          <textarea class="textarea mb-3" rows="3" placeholder="Nota interna..." [(ngModel)]="commentText"></textarea>
          <button type="button" class="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold" [disabled]="actionLoading()" (click)="confirmComment()">
            {{ actionLoading() ? 'Guardando...' : 'Guardar comentario' }}
          </button>
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
      { label: 'Total', value: stats.total, cls: 'text-slate-900' },
      { label: 'Reportadas', value: stats['reportado'] || 0, cls: 'text-slate-600' },
      { label: 'En atención', value: (stats['en-atencion'] || 0) + (stats['asignado'] || 0), cls: 'text-amber-600' },
      { label: 'Resueltas', value: stats['resuelto'] || 0, cls: 'text-emerald-600' },
      { label: 'Severidad alta', value: stats.altaSev, cls: 'text-red-600' }
    ];
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
    return ({ high: { cls: 'badge-danger', label: 'Alta' }, medium: { cls: 'badge-warning', label: 'Media' }, low: { cls: 'badge-success', label: 'Baja' } } as const)[s];
  }

  estadoBadge(e: IncidentStatus): string {
    return ({ reportado: 'badge-neutral', asignado: 'badge-info', 'en-atencion': 'badge-warning', resuelto: 'badge-success' } as const)[e];
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
      this.actionError.set(r.error ?? 'Error');
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
      this.actionError.set(r.error ?? 'Error');
      return;
    }
    this.commentModal.set(null);
    this.refresh();
  }

  async changeStatus(id: string, estado: IncidentStatus): Promise<void> {
    this.actionLoading.set(true);
    const r = await this.incidents.updateStatus(id, estado);
    this.actionLoading.set(false);
    if (!r.ok) this.actionError.set(r.error ?? 'Error');
    else this.refresh();
  }

  async remove(inc: Incident): Promise<void> {
    if (!confirm(`¿Eliminar incidencia ${inc.id}?`)) return;
    const r = await this.incidents.delete(inc.id);
    if (!r.ok) this.actionError.set(r.error ?? 'Error');
    else this.refresh();
  }
}
