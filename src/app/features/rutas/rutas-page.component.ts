import { ConfirmService } from '../../core/services/confirm.service';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { Router } from '@angular/router';
import {
  ArrowLeftRight,
  Ban,
  Clock,
  Crosshair,
  History,
  Loader2,
  LocateFixed,
  LucideAngularModule,
  MapPin,
  MousePointerClick,
  Navigation,
  Route,
  Star,
  Trash2,
  Truck,
  Volume2,
  X
} from 'lucide-angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import {
  GeoPlace,
  NavRoute,
  NavRouteStatus,
  PERU_CITIES,
  RoutePlan,
  TrafficEvent,
  TrafficStatus,
  statusBadge,
  statusLabel
} from '../../core/models/route.model';
import { FleetService } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { NavRoutesService } from '../../core/services/nav-routes.service';
import { NavSessionService } from '../../core/services/nav-session.service';
import { PlaceResult, PlacesService, formatDistance } from '../../core/services/places.service';
import { RoutingService } from '../../core/services/routing.service';
import { createOsmMap } from '../../core/utils/map.utils';
import { apiErrorMessage } from '../../core/utils/api-error.util';

@Component({
  standalone: true,
  selector: 'app-rutas-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div #rootEl class="relative h-[calc(var(--app-h)-4rem-env(safe-area-inset-top,0px)-var(--bnav,0px))] lg:flex lg:flex-row overflow-hidden">
      <!-- En el celular: panel que sube y baja sobre el mapa. En escritorio: columna fija a la izquierda. -->
      <aside
        class="route-sheet bg-white flex flex-col overflow-hidden absolute inset-x-0 bottom-0 z-[550] rounded-t-[22px] lg:static lg:z-10 lg:rounded-none lg:w-[400px] xl:w-[420px] lg:shrink-0 lg:border-r lg:border-slate-200"
        [class.is-dragging]="dragPx() !== null"
        [class.is-hidden]="sheetHidden()"
        [style.height.px]="sheetHeight()"
      >
        <button
          type="button"
          class="lg:hidden shrink-0 w-full pt-2.5 pb-1.5 flex flex-col items-center gap-1.5 touch-none cursor-grab active:cursor-grabbing"
          [attr.aria-label]="sheetSnap() === 'full' ? 'Bajar el panel para ver el mapa' : 'Subir el panel'"
          (pointerdown)="sheetDown($event)"
          (pointermove)="sheetMove($event)"
          (pointerup)="sheetUp($event)"
          (pointercancel)="sheetUp($event)"
        >
          <span class="w-10 h-1.5 rounded-full bg-slate-300"></span>
        </button>
        <div class="hidden lg:block p-4 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <lucide-icon [img]="routeIcon" [size]="20" class="text-blue-600" />
            Planificar ruta
          </h2>
          <p class="text-xs text-slate-500 mt-1">Elige origen y destino, y asigna la unidad.</p>
        </div>

        <div class="px-4 pb-4 pt-1 lg:pt-4 space-y-3 overflow-y-auto flex-1 overscroll-contain">
          <!-- Origen / Destino -->
          <div class="card p-3 space-y-2 relative">
            <div class="absolute left-[1.35rem] top-8 bottom-8 w-0.5 bg-slate-200"></div>

            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white z-10"></span>
              <input
                type="text"
                class="input pl-9 text-sm text-ellipsis"
                style="padding-right: 5.5rem"
                [placeholder]="locating() ? 'Buscando tu ubicación…' : 'Desde: tu ubicación o dirección'"
                [(ngModel)]="originQuery"
                (ngModelChange)="onOriginSearch($event)"
                (focus)="activeField.set('origin')"
                (blur)="closeSuggestionsSoon('origin')"
              />
              <button
                type="button"
                class="absolute right-12 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50"
                title="Usar mi ubicación actual"
                aria-label="Usar mi ubicación actual"
                [disabled]="locating()"
                (mousedown)="$event.preventDefault()"
                (click)="useMyLocation()"
              >
                <lucide-icon [img]="locateIcon" [size]="15" [class.animate-pulse]="locating()" />
              </button>
              @if (activeField() === 'origin') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2" (mousedown)="$event.preventDefault()" (click)="useMyLocation()">
                    <lucide-icon [img]="locateIcon" [size]="14" /> Usar mi ubicación actual
                  </button>
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100" (mousedown)="$event.preventDefault()" (click)="startMapPick('origin')">
                    <lucide-icon [img]="pickIcon" [size]="14" /> Elegir el punto en el mapa
                  </button>
                  @for (p of originSuggestions(); track $index) {
                    <button type="button" class="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start gap-2" (mousedown)="$event.preventDefault()" (click)="pickOrigin(p)">
                      <lucide-icon [img]="kindIcon(p)" [size]="13" class="mt-0.5 shrink-0" [class]="p.kind === 'saved' ? 'text-amber-500' : 'text-slate-400'" />
                      <span class="min-w-0 flex-1">
                        <span class="block text-xs font-medium text-slate-900 truncate">{{ p.name }}</span>
                        @if (p.detail) { <span class="block text-[10.5px] text-slate-500 truncate">{{ p.detail }}</span> }
                      </span>
                    </button>
                  }
                </div>
              }
            </div>

            <button
              type="button"
              class="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border border-slate-200"
              title="Intercambiar"
              (click)="swapPlaces()"
            >
              <lucide-icon [img]="swapIcon" [size]="14" />
            </button>

            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white z-10"></span>
              <input
                type="text"
                class="input pl-9 pr-12 text-sm"
                placeholder="¿A dónde vas?"
                [(ngModel)]="destQuery"
                (ngModelChange)="onDestSearch($event)"
                (focus)="onDestFocus()"
                (blur)="closeSuggestionsSoon('dest')"
                (keydown.enter)="pickFirstDest()"
                autocomplete="off"
                enterkeyhint="search"
              />
              @if (activeField() === 'dest') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
                  @if (destSearching()) {
                    <div class="px-3 py-2 text-[11px] text-blue-600 flex items-center gap-2 border-b border-slate-100">
                      <lucide-icon [img]="loaderIcon" [size]="12" class="animate-spin" /> Buscando «{{ destQuery.trim() }}»…
                    </div>
                  }
                  @if (destCategory(); as cat) {
                    <p class="px-3 pt-2 pb-1 text-[10.5px] text-slate-500 leading-snug">
                      No encontramos «{{ destQuery.trim() }}» en el mapa. <strong class="text-slate-700">{{ cat }}:</strong>
                    </p>
                  }
                  @if (!destQuery.trim() && destSuggestions().length) {
                    <p class="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Guardados y recientes</p>
                  }
                  @for (p of destSuggestions(); track $index) {
                    <div class="flex items-stretch hover:bg-slate-50">
                      <button type="button" class="flex-1 min-w-0 text-left px-3 py-2 flex items-start gap-2" (mousedown)="$event.preventDefault()" (click)="pickDest(p)">
                        <lucide-icon [img]="kindIcon(p)" [size]="14" class="mt-0.5 shrink-0" [class]="p.kind === 'saved' ? 'text-amber-500' : p.kind === 'recent' ? 'text-slate-400' : 'text-red-500'" />
                        <span class="min-w-0 flex-1">
                          <span class="block text-xs font-medium text-slate-900 truncate">
                            {{ p.name }}
                            @if (p.kind === 'saved' && p.shared) { <span class="ml-1 text-[9px] font-semibold text-blue-700 bg-blue-50 px-1 py-0.5 rounded">Empresa</span> }
                          </span>
                          @if (p.detail) { <span class="block text-[10.5px] text-slate-500 truncate">{{ p.detail }}</span> }
                        </span>
                        @if (p.distanceM != null) { <span class="text-[10px] text-slate-400 shrink-0 mt-0.5 tnum">{{ dist(p.distanceM) }}</span> }
                      </button>
                      @if (p.kind === 'saved' && p.mine && p.id) {
                        <button type="button" class="px-2 text-slate-300 hover:text-red-600" title="Borrar lugar guardado" aria-label="Borrar lugar guardado" (mousedown)="$event.preventDefault()" (click)="removeSaved(p)">
                          <lucide-icon [img]="trashIcon" [size]="13" />
                        </button>
                      }
                    </div>
                  }
                  @if (destNoResults()) {
                    <p class="px-3 py-2 text-[11px] text-slate-600 leading-snug">
                      No encontramos «{{ destQuery.trim() }}». Los negocios pequeños a veces no están en el mapa: prueba con la <strong>calle y el distrito</strong>, o marca el punto y guárdalo con un nombre.
                    </p>
                  }
                  @if (destError(); as err) {
                    <p class="px-3 py-2 text-[11px] text-red-600">{{ err }}</p>
                  }
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2 border-t border-slate-100" (mousedown)="$event.preventDefault()" (click)="startMapPick('dest')">
                    <lucide-icon [img]="pickIcon" [size]="14" /> Elegir el punto en el mapa
                  </button>
                </div>
              }
            </div>
          </div>

          @if (originInfo(); as info) {
            <p class="text-[11px] -mt-1 flex items-start gap-1.5" [class]="info.warn ? 'text-amber-700' : 'text-slate-500'">
              <lucide-icon [img]="crosshairIcon" [size]="12" class="mt-0.5 shrink-0" />
              <span>{{ info.text }}</span>
            </p>
          }
          @if (destination(); as d) {
            @if (savingPlace()) {
              <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-2 -mt-1">
                <label class="text-[11px] font-semibold text-slate-700" for="sp-name">Nombre para encontrar este lugar</label>
                <input id="sp-name" class="input text-sm" maxlength="80" placeholder="Ej. Casa, Almacén Callao, Cliente Gloria" [(ngModel)]="placeName" name="placeName" (keydown.enter)="savePlace()" />
                @if (auth.isStaff()) {
                  <label class="flex items-center gap-2 text-[11px] text-slate-600">
                    <input type="checkbox" class="accent-blue-600" [(ngModel)]="placeShared" name="placeShared" /> Compartir con toda la empresa (conductores incluidos)
                  </label>
                }
                <div class="flex gap-2">
                  <button type="button" class="flex-1 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-semibold text-slate-700" (click)="savingPlace.set(false)">Cancelar</button>
                  <button type="button" class="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11.5px] font-semibold disabled:opacity-50" [disabled]="!placeName.trim()" (click)="savePlace()">Guardar lugar</button>
                </div>
              </div>
            } @else if (!isSaved(d)) {
              <button type="button" class="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 -mt-1" (click)="startSavePlace()">
                <lucide-icon [img]="starIcon" [size]="12" /> Guardar este destino (Casa, cliente…) para encontrarlo por nombre
              </button>
            }
          }
          @if (placeMsg(); as m) {
            <p class="text-[11px] text-emerald-700 -mt-1">{{ m }}</p>
          }
          @if (plan()) {
            <p class="hidden lg:block text-[11px] text-slate-500 -mt-1">Puedes arrastrar los puntos verde y rojo en el mapa para ajustar el origen o el destino.</p>
          }

          <!-- Ciudades rápidas (en el celular se quitan al tener la ruta, para que el resultado quede a la vista) -->
          <div [class.hidden]="isMobile() && !!plan()">
            <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Ciudades frecuentes</p>
            <div class="flex flex-wrap gap-1.5">
              @for (c of quickCities; track c.name) {
                <button
                  type="button"
                  class="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-700 transition"
                  (click)="pickQuickCity(c)"
                >{{ c.name.split(',')[0] }}</button>
              }
            </div>
          </div>

          @if (planning()) {
            <div class="text-xs text-blue-600 flex items-center gap-2 py-2">
              <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" /> Calculando ruta...
            </div>
          }

          @if (plan(); as p) {
            <div class="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 fade-in-up">
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="text-sm font-semibold">{{ p.label }}</div>
                @if (p.trafficLevel) {
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" [class]="trafficPill(p.trafficLevel)">{{ trafficLabel(p.trafficLevel) }}</span>
                }
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Distancia</div>
                  <div class="text-lg font-bold">{{ p.distanceKm }} <span class="text-xs font-normal">km</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">{{ p.durationTrafficMin != null ? 'Con tráfico' : 'Tiempo est.' }}</div>
                  <div class="text-lg font-bold">{{ formatDuration(p.durationTrafficMin ?? p.durationMin) }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Tarifa ref.</div>
                  <div class="text-lg font-bold">S/ {{ fare() }}</div>
                </div>
              </div>
              @if (p.durationTrafficMin != null) {
                <p class="text-[10.5px] text-slate-400 mt-2 leading-snug">
                  Sin tráfico: {{ formatDuration(p.durationMin) }} · estimado para {{ p.franja }}@if (p.eventos?.length) {; pasa por {{ p.eventos!.length }} evento(s) de tráfico (+{{ eventDelay(p) }} min)}.
                </p>
              }
              @if (p.durationPredMin != null) {
                <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <span class="text-[10.5px] uppercase tracking-wide text-violet-300 font-semibold">Predicción con historial</span>
                  <span class="text-[15px] font-bold">{{ formatDuration(p.durationPredMin) }}</span>
                </div>
              }
            </div>

            @if (p.cierresEvitados?.length) {
              <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800 flex items-start gap-2">
                <lucide-icon [img]="banIcon" [size]="13" class="mt-0.5 shrink-0" />
                <span>Esta ruta <strong>rodea {{ p.cierresEvitados!.length === 1 ? 'una calle cerrada' : p.cierresEvitados!.length + ' calles cerradas' }}</strong> reportada{{ p.cierresEvitados!.length === 1 ? '' : 's' }} en el camino.</span>
              </div>
            }
            @if (p.pasaPorCierre) {
              <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 flex items-start gap-2">
                <lucide-icon [img]="banIcon" [size]="13" class="mt-0.5 shrink-0" />
                <span>Esta ruta <strong>pasa por una calle cerrada</strong> y no se encontró cómo rodearla. Revisa el mapa o elige otra alternativa.</span>
              </div>
            }

            @if (p.historico; as h) {
              <div class="rounded-xl ring-1 ring-violet-200 bg-violet-50/60 p-3.5 fade-in-up">
                <div class="flex items-center gap-2 mb-1.5">
                  <lucide-icon [img]="historyIcon" [size]="14" class="text-violet-600" />
                  <p class="text-[12.5px] font-semibold text-violet-900">Datos históricos del corredor</p>
                </div>
                @if (h.viajes) {
                  <p class="text-[11.5px] text-slate-700 leading-snug">
                    Basado en <strong>{{ h.viajes }} viajes completados</strong> {{ h.corredor }}.
                    @if (h.usaFranja) {
                      Los {{ h.viajesFranja }} que salieron en la franja «{{ h.franja }}» tardaron
                    } @else {
                      En promedio los viajes tardaron
                    }
                    <strong>{{ pctLabel(h.ratio!) }}</strong> que el tiempo sin tráfico.
                  </p>
                  <p class="text-[11.5px] text-slate-700 mt-1">
                    Predicción para este viaje: <strong>{{ formatDuration(h.prediccionMin!) }}</strong>&nbsp;<span class="text-slate-500">(entre {{ formatDuration(h.rangoMin![0]) }} y {{ formatDuration(h.rangoMin![1]) }})</span>
                  </p>
                  @if (h.mejorFranja; as mf) {
                    <p class="text-[11.5px] text-emerald-700 mt-1">
                      Mejor hora para salir según el historial: <strong>{{ mf.franja }}</strong> (~{{ formatDuration(mf.prediccionMin) }}).
                    </p>
                  }
                  @if (h.porFranja?.length) {
                    <div class="mt-2.5 space-y-1">
                      @for (f of h.porFranja; track f.franja) {
                        <div class="flex items-center gap-2 text-[10.5px]">
                          <span class="w-[118px] shrink-0 truncate" [class]="f.franja === h.franja ? 'font-semibold text-violet-800' : 'text-slate-500'">{{ f.franja }}</span>
                          <span class="flex-1 h-1.5 rounded-full bg-white overflow-hidden ring-1 ring-violet-100">
                            <span class="block h-full rounded-full" [class]="f.franja === h.franja ? 'bg-violet-600' : 'bg-violet-300'" [style.width.%]="barPct(f.prediccionMin, h)"></span>
                          </span>
                          <span class="w-12 text-right tnum text-slate-600">{{ formatDuration(f.prediccionMin) }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (h.ultimos?.length) {
                    <p class="text-[10.5px] text-slate-500 mt-2.5">
                      Últimos viajes:
                      @for (u of h.ultimos; track u.fecha; let last = $last) {
                        {{ u.fecha | date: 'dd/MM' }} {{ u.placa ?? '' }} {{ formatDuration(u.duracionMin) }}{{ last ? '' : ' · ' }}
                      }
                    </p>
                  }
                } @else {
                  <p class="text-[11.5px] text-slate-600 leading-snug">{{ h.mensaje }}</p>
                }
              </div>
            }

            @if (plans().length > 1) {
              <div>
                <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Rutas alternativas ({{ plans().length }})</p>
                <div class="space-y-1.5">
                  @for (alt of plans(); track $index; let i = $index) {
                    <button
                      type="button"
                      class="w-full text-left rounded-lg border px-3 py-2 transition flex items-center gap-3"
                      [class]="selectedPlan() === i ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 hover:border-slate-300'"
                      (click)="selectPlan(i)"
                    >
                      <span class="w-3 h-3 rounded-full shrink-0" [style.background]="altColor(i)"></span>
                      <span class="flex-1 min-w-0">
                        <span class="block text-[12.5px] font-semibold text-slate-900">
                          {{ formatDuration(alt.durationTrafficMin ?? alt.durationMin) }} · {{ alt.distanceKm }} km
                          @if (alt.recomendada) {
                            <span class="ml-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Más rápida</span>
                          }
                        </span>
                        <span class="block text-[11px] text-slate-500">
                          {{ i === 0 ? 'Ruta principal' : 'Alternativa ' + i }}
                          @if (alt.trafficLevel) { · tráfico {{ trafficLabel(alt.trafficLevel).toLowerCase() }} }
                          @if (alt.eventos?.length) { · {{ alt.eventos!.length }} evento(s) }
                        </span>
                      </span>
                    </button>
                  }
                </div>
              </div>
            }
          }

          @if (plan()) {
            <div>
              <label class="input-label flex items-center gap-1">
                <lucide-icon [img]="truckIcon" [size]="14" /> Asignar vehículo (opcional)
              </label>
              <select class="select text-sm" [(ngModel)]="selectedVehicleId" name="vehicle">
                <option value="">Sin asignar — queda solicitada</option>
                @for (v of fleet.vehicles(); track v.placa) {
                  @if (v.id) {
                    <option [value]="v.id">{{ v.placa }} · {{ v.modelo }}</option>
                  }
                }
              </select>
            </div>

            <button
              type="button"
              class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              [disabled]="creating()"
              (click)="createRoute()"
            >
              @if (creating()) {
                <lucide-icon [img]="loaderIcon" [size]="18" class="animate-spin" />
              } @else {
                <lucide-icon [img]="navIcon" [size]="18" />
              }
              Solicitar ruta
            </button>
            <button
              type="button"
              class="w-full py-3 rounded-xl ring-1 ring-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold text-sm flex items-center justify-center gap-2"
              (click)="navigateNow()"
            >
              <lucide-icon [img]="voiceIcon" [size]="17" /> Ir ahora con guía por voz
            </button>
          }

          @if (formError()) {
            <p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{{ formError() }}</p>
          }

          @if (traffic(); as t) {
            <div class="rounded-lg border border-slate-200 px-3 py-2 text-[11.5px] text-slate-600 flex items-start gap-2">
              <span class="w-2 h-2 rounded-full mt-1 shrink-0" [class]="t.nivel === 'congestionado' ? 'bg-red-500' : t.nivel === 'moderado' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span>
                Tráfico estimado en Lima: <strong>{{ trafficLabel(t.nivel).toLowerCase() }}</strong> ({{ t.franja }})
                @if (t.eventos.length) { · {{ t.eventos.length }} evento(s) activos en el mapa }
              </span>
            </div>
          }

          <div class="rounded-lg border border-slate-200 px-3 py-2.5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                <lucide-icon [img]="banIcon" [size]="13" class="text-red-600" /> Calles cerradas
                <span class="text-[10.5px] font-medium text-slate-500">({{ closures().length }})</span>
              </p>
              <button type="button" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100" (click)="startClosurePick()">Reportar calle cerrada</button>
            </div>
            <p class="text-[10.5px] text-slate-500 mt-1 leading-snug">Marca en el mapa una calle cerrada (obra, feria, accidente). Las rutas la rodean hasta que venza o alguien la reabra.</p>
            @for (c of closures(); track c.id) {
              <div class="flex items-center gap-2 mt-2 text-[11px]">
                <button type="button" class="flex-1 min-w-0 text-left hover:text-blue-700" (click)="focusClosure(c)">
                  <span class="block font-medium text-slate-800 truncate">{{ c.descripcion }}</span>
                  <span class="block text-[10px] text-slate-500 truncate">{{ c.reportadoPor ? 'Reportó ' + c.reportadoPor + ' · ' : '' }}vence {{ c.expira | date: 'dd/MM HH:mm' }}</span>
                </button>
                <button type="button" class="shrink-0 text-[10px] font-semibold px-2 py-1 rounded bg-emerald-100 text-emerald-800" (click)="reopenClosure(c)">Ya está abierta</button>
              </div>
            }
          </div>

          <!-- Lista de rutas -->
          <div class="pt-2">
            <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Rutas ({{ navRoutes.routes().length }})</p>
            @if (navRoutes.loading()) {
              <div class="space-y-2" aria-label="Cargando rutas" role="status">
                @for (n of [1, 2]; track n) {
                  <div class="rounded-lg border border-slate-200 p-3 space-y-2">
                    <span class="skeleton h-3.5 w-3/5"></span>
                    <span class="skeleton h-3 w-2/5"></span>
                    <span class="skeleton h-1.5 w-full"></span>
                  </div>
                }
              </div>
            } @else if (navRoutes.routes().length === 0) {
              <p class="text-xs text-slate-500">No hay rutas creadas aún. Elige origen y destino arriba para crear la primera.</p>
            } @else {
              <div class="space-y-2">
                @for (r of navRoutes.routes(); track r.id) {
                  <div
                    class="rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition cursor-pointer"
                    [class.ring-2]="selectedRouteId() === r.id"
                    [class.ring-blue-400]="selectedRouteId() === r.id"
                    (click)="showRouteOnMap(r)"
                  >
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <strong class="text-sm text-slate-900">{{ r.routeLabel }}</strong>
                      <span class="badge text-[10px]" [class]="statusBadgeFn(r.status)">{{ statusLabelFn(r.status) }}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mb-2">
                      {{ r.distanceKm ?? '—' }} km · {{ formatDuration(r.durationMin ?? 0) }}
                      @if (r.vehiclePlaca) { · {{ r.vehiclePlaca }} }
                    </div>
                    @if (r.status === 'en-curso') {
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2">
                        <div class="h-full bg-emerald-500 transition-all duration-700" [style.width.%]="r.progressPct"></div>
                      </div>
                    }
                    @if (!isSimLoop(r) && (r.status === 'en-curso' || r.status === 'asignada')) {
                      <button type="button" class="mb-2 text-[10.5px] font-semibold px-2.5 py-1 rounded bg-blue-600 text-white inline-flex items-center gap-1" (click)="navigateRoute(r, $event)">
                        <lucide-icon [img]="voiceIcon" [size]="11" /> Navegar con voz
                      </button>
                    }
                    @if (isSimLoop(r)) {
                      <p class="text-[10.5px] text-violet-700">Circuito permanente de la unidad de prueba. Se controla desde el Simulador.</p>
                    } @else if (auth.isStaff()) {
                      <div class="flex flex-wrap gap-1.5">
                        @if (r.status === 'solicitada' || r.status === 'asignada') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-100 text-emerald-800" (click)="setStatus(r, 'en-curso', $event)">Iniciar</button>
                        }
                        @if (r.status === 'en-curso') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800" (click)="setStatus(r, 'completada', $event)">Completar</button>
                        }
                        @if (r.status !== 'completada' && r.status !== 'cancelada') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-red-100 text-red-800" (click)="cancelRoute(r, $event)">Cancelar</button>
                        }
                        <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700" (click)="deleteRoute(r, $event)">Eliminar</button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- Mapa -->
      <div class="absolute inset-0 lg:relative lg:inset-auto lg:flex-1 lg:min-h-0">
        <div #mapEl class="absolute inset-0" [class.cursor-crosshair]="pickMode()"></div>
        @if (pickMode(); as mode) {
          <div class="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-900 text-white px-4 py-2 rounded-full text-xs shadow-lg flex items-center gap-2">
            <lucide-icon [img]="pickIcon" [size]="14" />
            {{ mode === 'cierre' ? 'Toca en el mapa la calle que está cerrada' : 'Toca el mapa para elegir el ' + (mode === 'origin' ? 'origen' : 'destino') }}
            <button type="button" class="ml-1 p-0.5 rounded-full hover:bg-white/20" aria-label="Cancelar" (click)="pickMode.set(null)">
              <lucide-icon [img]="xIcon" [size]="13" />
            </button>
          </div>
        }
        @if (closureDraft(); as cd) {
          <div class="absolute bottom-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[380px] z-[600] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-4">
            <p class="text-[13.5px] font-semibold text-slate-900 flex items-center gap-2">
              <lucide-icon [img]="banIcon" [size]="15" class="text-red-600" /> Reportar calle cerrada
            </p>
            <p class="text-[11.5px] text-slate-500 mt-0.5 truncate">{{ cd.name }}</p>
            <label class="input-label mt-3" for="cl-desc">Motivo (opcional)</label>
            <input id="cl-desc" class="input text-sm" maxlength="120" placeholder="Obra, feria, accidente, vía rota…" [(ngModel)]="closureDesc" name="closureDesc" />
            <p class="input-label mt-3">¿Cuánto tiempo estará cerrada?</p>
            <div class="grid grid-cols-4 gap-1.5">
              @for (o of closureOptions; track o.h) {
                <button type="button" class="py-1.5 rounded-lg text-[11px] font-semibold ring-1" [class]="closureHours === o.h ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-700 ring-slate-200'" (click)="closureHours = o.h">{{ o.label }}</button>
              }
            </div>
            <div class="flex gap-2 mt-4">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-700 text-[13px] font-semibold" [disabled]="closureSaving()" (click)="cancelClosure()">Cancelar</button>
              <button type="button" class="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold disabled:opacity-50" [disabled]="closureSaving()" (click)="submitClosure()">{{ closureSaving() ? 'Reportando…' : 'Reportar cierre' }}</button>
            </div>
          </div>
        }
        @if (!plan() && !selectedRouteId() && !pickMode() && !closureDraft()) {
          <div class="hidden lg:flex absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full text-xs text-slate-600 shadow-lg border border-slate-200 flex items-center gap-2">
            <lucide-icon [img]="mapPinIcon" [size]="14" class="text-blue-600" />
            Elige origen y destino para ver la ruta
          </div>
        }
      </div>
    </div>
  `
})
export class RutasPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly confirmDialog = inject(ConfirmService);
  readonly auth = inject(AuthService);
  readonly fleet = inject(FleetService);
  readonly navRoutes = inject(NavRoutesService);
  private readonly routing = inject(RoutingService);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('rootEl') rootEl!: ElementRef<HTMLDivElement>;

  // ─────────────── panel deslizable (celular) ───────────────
  readonly isMobile = signal(typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  readonly sheetSnap = signal<'peek' | 'half' | 'full'>('half');
  readonly dragPx = signal<number | null>(null);
  private readonly rootH = signal(640);
  private dragStart: { y: number; h: number; moved: boolean } | null = null;

  private snapPx(snap: 'peek' | 'half' | 'full'): number {
    const h = this.rootH();
    return snap === 'peek' ? Math.min(168, h - 8) : snap === 'half' ? Math.round(h * 0.5) : h - 8;
  }
  /** Alto del panel en el celular; en escritorio no se fija (ocupa su columna). */
  readonly sheetHeight = computed(() => (this.isMobile() ? (this.dragPx() ?? this.snapPx(this.sheetSnap())) : null));
  /** Al marcar un punto en el mapa el panel se quita del medio. */
  readonly sheetHidden = computed(() => this.isMobile() && (!!this.pickMode() || !!this.closureDraft()));

  private readonly sheetEffect = effect(() => {
    // Escribir en un buscador sube el panel (hace falta espacio para la lista); con la ruta lista baja a la mitad.
    const campo = this.activeField();
    const plan = this.plan();
    untracked(() => {
      if (campo) this.sheetSnap.set('full');
      else if (plan && this.sheetSnap() === 'full') this.sheetSnap.set('half');
    });
  });

  sheetDown(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragStart = { y: e.clientY, h: this.sheetHeight() ?? this.snapPx('half'), moved: false };
  }

  sheetMove(e: PointerEvent): void {
    const d = this.dragStart;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (d.moved) this.dragPx.set(Math.max(96, Math.min(this.rootH() - 8, d.h + dy)));
  }

  sheetUp(_e: PointerEvent): void {
    const d = this.dragStart;
    this.dragStart = null;
    if (!d) return;
    const px = this.dragPx();
    this.dragPx.set(null);
    if (!d.moved || px === null) {
      // Toque simple: alterna entre ver el mapa y ver el panel.
      this.sheetSnap.set(this.sheetSnap() === 'peek' ? 'half' : this.sheetSnap() === 'half' ? 'full' : 'half');
      return;
    }
    const snaps = ['peek', 'half', 'full'] as const;
    this.sheetSnap.set(snaps.reduce((a, b) => (Math.abs(this.snapPx(b) - px) < Math.abs(this.snapPx(a) - px) ? b : a)));
  }

  private readonly onResize = (): void => {
    this.isMobile.set(window.matchMedia('(max-width: 1023px)').matches);
    if (this.rootEl) this.rootH.set(this.rootEl.nativeElement.clientHeight || 640);
    this.map?.invalidateSize();
  };

  /** Encuadra la ruta en la parte del mapa que no tapa el panel. */
  private fitVisible(bounds: L.LatLngBounds): void {
    if (!this.map) return;
    if (!this.isMobile()) {
      this.map.fitBounds(bounds);
      return;
    }
    if (this.sheetSnap() === 'full') this.sheetSnap.set('half');
    this.map.fitBounds(bounds, { paddingTopLeft: [28, 28], paddingBottomRight: [28, this.snapPx(this.sheetSnap()) + 20] });
  }

  readonly routeIcon = Route;
  readonly swapIcon = ArrowLeftRight;
  readonly loaderIcon = Loader2;
  readonly historyIcon = History;
  readonly navIcon = Navigation;
  readonly truckIcon = Truck;
  readonly mapPinIcon = MapPin;
  readonly locateIcon = LocateFixed;
  readonly pickIcon = MousePointerClick;
  readonly crosshairIcon = Crosshair;
  readonly xIcon = X;

  readonly locating = signal(false);
  readonly pickMode = signal<'origin' | 'dest' | 'cierre' | null>(null);
  readonly banIcon = Ban;
  readonly starIcon = Star;
  readonly clockIcon = Clock;
  readonly trashIcon = Trash2;
  readonly voiceIcon = Volume2;

  private readonly places = inject(PlacesService);
  private readonly router = inject(Router);
  private readonly navSession = inject(NavSessionService);

  readonly destSearching = signal(false);
  readonly destCategory = signal<string | null>(null);
  readonly destNoResults = signal(false);
  readonly destError = signal<string | null>(null);
  private destSearchSeq = 0;

  readonly savingPlace = signal(false);
  readonly placeMsg = signal<string | null>(null);
  placeName = '';
  placeShared = false;

  readonly closures = computed<TrafficEvent[]>(() => (this.traffic()?.eventos ?? []).filter((e) => e.nivel === 'cierre'));
  readonly closureDraft = signal<{ lat: number; lng: number; name: string } | null>(null);
  readonly closureSaving = signal(false);
  readonly closureOptions = [
    { h: 2, label: '2 horas' },
    { h: 12, label: 'Hoy' },
    { h: 72, label: '3 días' },
    { h: 168, label: '1 semana' }
  ];
  closureHours = 12;
  closureDesc = '';
  private closureMarker: L.Marker | null = null;
  readonly originInfo = signal<{ text: string; warn: boolean } | null>(null);
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  readonly quickCities = PERU_CITIES;
  readonly statusLabelFn = statusLabel;
  readonly statusBadgeFn = statusBadge;

  originQuery = '';
  destQuery = '';
  origin = signal<GeoPlace | null>(null);
  destination = signal<GeoPlace | null>(null);
  originSuggestions = signal<PlaceResult[]>([]);
  destSuggestions = signal<PlaceResult[]>([]);
  activeField = signal<'origin' | 'dest' | null>(null);

  readonly plans = signal<RoutePlan[]>([]);
  readonly selectedPlan = signal(0);
  readonly plan = computed<RoutePlan | null>(() => this.plans()[this.selectedPlan()] ?? null);
  readonly traffic = signal<TrafficStatus | null>(null);
  readonly planning = signal(false);
  readonly creating = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedRouteId = signal<string | null>(null);

  selectedVehicleId = '';

  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
  private altLines: L.Polyline[] = [];
  private trafficLayer: L.LayerGroup | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private originMarker: L.Marker | null = null;
  private destMarker: L.Marker | null = null;
  private myLocationLayer: L.LayerGroup | null = null;
  private readonly originSearch$ = new Subject<string>();
  private readonly destSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.layout.setPage('Rutas', 'Crea viajes de origen a destino y asígnalos a la flota');
    void this.fleet.load();
    void this.navRoutes.load();

    this.originSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => void this.searchOrigin(q));

    this.destSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => void this.searchDest(q));
  }

  async ngAfterViewInit(): Promise<void> {
    this.map = createOsmMap(this.mapEl.nativeElement, [-9.19, -75.0], 6);
    this.onResize();
    window.addEventListener('resize', this.onResize);
    // En el celular el panel tapa la parte de abajo: los créditos del mapa van arriba para que sigan visibles.
    if (this.isMobile()) this.map.attributionControl?.setPosition('topright');
    this.trafficLayer = L.layerGroup().addTo(this.map);
    this.myLocationLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => void this.onMapClick(e.latlng.lat, e.latlng.lng));
    setTimeout(() => this.map?.invalidateSize(), 100);
    // «Desde» parte de tu ubicación actual, como en las apps de transporte.
    void this.autoLocateOrigin();
    void this.loadTraffic();
    void this.places.loadSaved();
    // Progreso de rutas en curso y eventos de tráfico.
    this.poll = setInterval(() => {
      if (document.hidden) return;
      void this.navRoutes.load();
      void this.loadTraffic();
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
    window.removeEventListener('resize', this.onResize);
    this.map?.remove();
    this.map = null;
  }

  private async loadTraffic(): Promise<void> {
    const t = await this.routing.trafficStatus();
    this.traffic.set(t);
    if (!this.trafficLayer) return;
    this.trafficLayer.clearLayers();
    for (const ev of t?.eventos ?? []) {
      if (ev.nivel === 'cierre') {
        this.drawClosure(ev);
        continue;
      }
      const color = ev.nivel === 'bloqueo' ? '#7f1d1d' : ev.nivel === 'congestionado' ? '#dc2626' : '#f59e0b';
      L.circle([ev.lat, ev.lng], { radius: ev.radioM, color, weight: 2, fillColor: color, fillOpacity: 0.2, dashArray: '4 4' })
        .bindTooltip(`<strong>${ev.descripcion}</strong><br/>${ev.nivel}${ev.simulado ? ' · simulado' : ''}`)
        .addTo(this.trafficLayer);
    }
  }

  /** Si el permiso ya está concedido (o se puede pedir), el origen se llena solo con tu ubicación. */
  private async autoLocateOrigin(): Promise<void> {
    if (this.origin()) return;
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (perm && perm.state === 'denied') {
        this.originInfo.set({ text: 'La ubicación está bloqueada en este navegador: escribe el origen o elígelo en el mapa.', warn: true });
        return;
      }
    } catch {
      /* Safari antiguo sin Permissions API: se intenta directo */
    }
    await this.useMyLocation(true);
  }

  async useMyLocation(silent = false): Promise<void> {
    this.activeField.set(null);
    this.locating.set(true);
    if (!silent) this.originInfo.set(null);
    try {
      const pos = await this.routing.currentPosition();
      const calle = await this.routing.reverseGeocode(pos.lat, pos.lng);
      const place: GeoPlace = { name: `Mi ubicación · ${calle}`, lat: pos.lat, lng: pos.lng };
      this.origin.set(place);
      this.originQuery = place.name;
      this.originSuggestions.set([]);
      const acc = pos.accuracy >= 1000 ? `${(pos.accuracy / 1000).toFixed(1)} km` : `${pos.accuracy} m`;
      this.originInfo.set(
        pos.accuracy > 100
          ? { text: `Ubicación aproximada (±${acc}). Si no es tu punto exacto, arrastra el marcador verde o elígelo en el mapa.`, warn: true }
          : { text: `Ubicación actual con precisión de ±${acc}.`, warn: false }
      );
      this.drawMyLocation(pos.lat, pos.lng, pos.accuracy);
      if (this.destination()) await this.tryPlan();
    } catch (e) {
      if (!silent) this.originInfo.set({ text: e instanceof Error ? e.message : 'No se pudo obtener tu ubicación.', warn: true });
    } finally {
      this.locating.set(false);
    }
  }

  private drawMyLocation(lat: number, lng: number, acc: number): void {
    if (!this.map || !this.myLocationLayer) return;
    this.myLocationLayer.clearLayers();
    L.circle([lat, lng], { radius: acc, color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false }).addTo(this.myLocationLayer);
    if (!this.plan()) {
      this.map.setView([lat, lng], acc > 1000 ? 13 : 15);
      this.drawPins();
    }
  }

  startMapPick(field: 'origin' | 'dest'): void {
    this.activeField.set(null);
    this.pickMode.set(field);
    const o = this.origin();
    if (this.map && o && this.map.getZoom() < 12) this.map.setView([o.lat, o.lng], 14);
  }

  private async onMapClick(lat: number, lng: number): Promise<void> {
    const mode = this.pickMode();
    if (!mode) return;
    this.pickMode.set(null);
    if (mode === 'cierre') {
      await this.draftClosure(lat, lng);
      return;
    }
    await this.setPoint(mode, lat, lng);
  }

  // ─────────────── calles cerradas ───────────────

  private closureIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: '<div style="width:26px;height:26px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center"><div style="width:13px;height:4px;border-radius:2px;background:#fff"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  private drawClosure(ev: TrafficEvent): void {
    if (!this.trafficLayer) return;
    const vence = ev.expira ? new Date(ev.expira).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const box = document.createElement('div');
    box.style.minWidth = '170px';
    const title = document.createElement('strong');
    title.textContent = ev.descripcion;
    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px;color:#475569;margin:2px 0 8px';
    info.textContent = `Calle cerrada${ev.reportadoPor ? ' · reportó ' + ev.reportadoPor : ''}${vence ? ' · vence ' + vence : ''}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ya está abierta';
    btn.style.cssText = 'font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;background:#d1fae5;color:#065f46;border:0;cursor:pointer';
    btn.addEventListener('click', () => void this.reopenClosure(ev));
    box.append(title, info, btn);
    L.circle([ev.lat, ev.lng], { radius: ev.radioM, color: '#dc2626', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.18, interactive: false }).addTo(this.trafficLayer);
    L.marker([ev.lat, ev.lng], { icon: this.closureIcon(), zIndexOffset: 400 }).bindPopup(box).bindTooltip(`Calle cerrada: ${ev.descripcion}`).addTo(this.trafficLayer);
  }

  startClosurePick(): void {
    this.activeField.set(null);
    this.closureDraft.set(null);
    this.pickMode.set('cierre');
    const ref = this.origin() ?? this.destination();
    if (this.map && ref && this.map.getZoom() < 15) this.map.setView([ref.lat, ref.lng], 16);
  }

  private async draftClosure(lat: number, lng: number): Promise<void> {
    this.closureMarker?.remove();
    if (this.map) this.closureMarker = L.marker([lat, lng], { icon: this.closureIcon(), zIndexOffset: 900 }).addTo(this.map);
    this.closureDesc = '';
    this.closureHours = 12;
    this.closureDraft.set({ lat, lng, name: 'Buscando la calle…' });
    const name = await this.routing.reverseGeocode(lat, lng);
    if (this.closureDraft()?.lat === lat) this.closureDraft.set({ lat, lng, name });
  }

  cancelClosure(): void {
    this.closureMarker?.remove();
    this.closureMarker = null;
    this.closureDraft.set(null);
  }

  async submitClosure(): Promise<void> {
    const cd = this.closureDraft();
    if (!cd) return;
    this.closureSaving.set(true);
    this.formError.set(null);
    try {
      const calle = cd.name.split(',')[0];
      const motivo = this.closureDesc.trim();
      const res = await this.routing.reportClosure({
        lat: cd.lat,
        lng: cd.lng,
        descripcion: motivo ? `${calle}: ${motivo}` : `Calle cerrada en ${calle}`,
        duracionH: this.closureHours
      });
      this.cancelClosure();
      this.placeMsg.set(
        res.confirmado
          ? 'Ese cierre ya estaba reportado: se confirmó y se extendió su vigencia.'
          : 'Calle cerrada reportada. Las rutas nuevas la rodean' + (res.unidadesAfectadas.length ? ` y se avisó a ${res.unidadesAfectadas.join(', ')}.` : '.')
      );
      setTimeout(() => this.placeMsg.set(null), 6000);
      await this.loadTraffic();
      if (this.origin() && this.destination()) await this.tryPlan();
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo reportar la calle cerrada'));
    } finally {
      this.closureSaving.set(false);
    }
  }

  focusClosure(c: TrafficEvent): void {
    this.map?.setView([c.lat, c.lng], 17);
  }

  async reopenClosure(c: TrafficEvent): Promise<void> {
    if (!(await this.confirmDialog.ask(`¿Confirmas que «${c.descripcion}» ya está abierta? Las rutas volverán a pasar por ahí.`, { okLabel: 'Sí, está abierta', danger: false }))) return;
    try {
      await this.routing.reopenClosure(c.id);
      this.map?.closePopup();
      await this.loadTraffic();
      if (this.origin() && this.destination()) await this.tryPlan();
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo reabrir la calle'));
    }
  }

  // ─────────────── lugares guardados y navegación ───────────────

  kindIcon(p: PlaceResult) {
    return p.kind === 'saved' ? this.starIcon : p.kind === 'recent' ? this.clockIcon : this.mapPinIcon;
  }

  dist(m: number): string {
    return formatDistance(m);
  }

  onDestFocus(): void {
    this.activeField.set('dest');
    if (!this.destQuery.trim()) this.showShortcuts();
  }

  private showShortcuts(): void {
    this.destCategory.set(null);
    this.destNoResults.set(false);
    this.destError.set(null);
    this.destSuggestions.set(this.places.shortcuts(this.origin()));
  }

  pickFirstDest(): void {
    const first = this.destSuggestions()[0];
    if (first && !this.destSearching()) this.pickDest(first);
  }

  isSaved(d: GeoPlace): boolean {
    return this.places.saved().some((s) => Math.abs(s.lat - d.lat) < 0.0003 && Math.abs(s.lng - d.lng) < 0.0003);
  }

  startSavePlace(): void {
    this.placeName = '';
    this.placeShared = false;
    this.savingPlace.set(true);
  }

  async savePlace(): Promise<void> {
    const d = this.destination();
    if (!d || !this.placeName.trim()) return;
    try {
      const saved = await this.places.save(this.placeName, { name: d.name, lat: d.lat, lng: d.lng }, this.placeShared);
      this.savingPlace.set(false);
      this.placeMsg.set(`«${saved.nombre}» guardado. La próxima vez escribe su nombre en «¿A dónde vas?».`);
      setTimeout(() => this.placeMsg.set(null), 6000);
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo guardar el lugar'));
    }
  }

  async removeSaved(p: PlaceResult): Promise<void> {
    if (!p.id) return;
    if (!(await this.confirmDialog.ask(`¿Borrar el lugar guardado «${p.name}»?`, { okLabel: 'Borrar' }))) return;
    try {
      await this.places.remove(p.id);
      this.showShortcuts();
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo borrar el lugar'));
    }
  }

  /** Abre la navegación con voz hacia el destino elegido (sin crear una ruta). */
  navigateNow(): void {
    const d = this.destination();
    if (!d) return;
    this.navSession.target.set({ dest: d, label: d.name.split(',')[0] });
    void this.router.navigate(['/navegar']);
  }

  navigateRoute(r: NavRoute, ev: Event): void {
    ev.stopPropagation();
    this.navSession.target.set({ dest: { name: r.destName, lat: r.destLat, lng: r.destLng }, routeId: r.id, label: r.routeLabel });
    void this.router.navigate(['/navegar', r.id]);
  }

  /** Fija origen o destino en un punto exacto (clic en el mapa o marcador arrastrado). */
  private async setPoint(field: 'origin' | 'dest', lat: number, lng: number): Promise<void> {
    const name = await this.routing.reverseGeocode(lat, lng);
    const place: GeoPlace = { name, lat, lng };
    if (field === 'origin') {
      this.origin.set(place);
      this.originQuery = name;
      this.originInfo.set({ text: 'Origen elegido en el mapa.', warn: false });
    } else {
      this.destination.set(place);
      this.destQuery = name;
    }
    if (this.origin() && this.destination()) await this.tryPlan();
    else this.drawPins();
  }

  closeSuggestionsSoon(field: 'origin' | 'dest'): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    // Sólo se cierra si el foco no pasó al otro campo.
    this.blurTimer = setTimeout(() => {
      if (this.activeField() === field) this.activeField.set(null);
    }, 150);
  }

  private pinIcon(color: string, label: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div title="${label}" style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);cursor:grab"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  /** Marcadores de origen/destino arrastrables para ajustar el punto a mano. */
  private drawPins(): void {
    if (!this.map) return;
    this.originMarker?.remove();
    this.destMarker?.remove();
    this.originMarker = this.destMarker = null;
    const o = this.origin();
    const d = this.destination();
    if (o) {
      this.originMarker = L.marker([o.lat, o.lng], { icon: this.pinIcon('#10b981', 'Origen'), draggable: true, zIndexOffset: 500 })
        .bindTooltip('Origen · arrástralo para ajustar')
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          void this.setPoint('origin', ll.lat, ll.lng);
        })
        .addTo(this.map);
    }
    if (d) {
      this.destMarker = L.marker([d.lat, d.lng], { icon: this.pinIcon('#ef4444', 'Destino'), draggable: true, zIndexOffset: 500 })
        .bindTooltip('Destino · arrástralo para ajustar')
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          void this.setPoint('dest', ll.lat, ll.lng);
        })
        .addTo(this.map);
    }
  }

  isSimLoop(r: NavRoute): boolean {
    return (r.notes ?? '').startsWith('[circuito-sim]');
  }

  altColor(i: number): string {
    return ['#2563eb', '#7c3aed', '#0d9488'][i] ?? '#64748b';
  }

  trafficLabel(level: string): string {
    return ({ fluido: 'Fluido', moderado: 'Moderado', congestionado: 'Congestionado' } as Record<string, string>)[level] ?? level;
  }

  trafficPill(level: string): string {
    return (
      ({ fluido: 'bg-emerald-500/20 text-emerald-200', moderado: 'bg-amber-500/20 text-amber-200', congestionado: 'bg-red-500/25 text-red-200' } as Record<string, string>)[level] ??
      'bg-slate-700 text-slate-200'
    );
  }

  eventDelay(p: RoutePlan): number {
    return (p.eventos ?? []).reduce((acc, e) => acc + e.demora_min, 0);
  }

  selectPlan(i: number): void {
    this.selectedPlan.set(i);
    this.drawPlans();
  }

  onOriginSearch(q: string): void {
    this.originSearch$.next(q);
  }

  onDestSearch(q: string): void {
    this.destSearch$.next(q);
  }

  async searchOrigin(q: string): Promise<void> {
    if (q.trim().length < 2) {
      this.originSuggestions.set([]);
      return;
    }
    try {
      this.originSuggestions.set((await this.places.search(q, this.destination() ?? this.origin())).results);
    } catch {
      this.originSuggestions.set([]);
    }
  }

  async searchDest(q: string): Promise<void> {
    const seq = ++this.destSearchSeq;
    this.destError.set(null);
    if (q.trim().length < 2) {
      this.destSearching.set(false);
      this.showShortcuts();
      return;
    }
    this.destSearching.set(true);
    this.destNoResults.set(false);
    try {
      // Se busca primero cerca del origen (tu ubicación), como en las apps de navegación.
      const out = await this.places.search(q, this.origin());
      if (seq !== this.destSearchSeq) return;
      this.destSuggestions.set(out.results);
      this.destCategory.set(out.categoryLabel ?? null);
      this.destNoResults.set(out.results.length === 0);
    } catch (e) {
      if (seq !== this.destSearchSeq) return;
      this.destSuggestions.set([]);
      this.destCategory.set(null);
      this.destError.set(e instanceof Error ? e.message : 'No se pudo buscar');
    } finally {
      if (seq === this.destSearchSeq) this.destSearching.set(false);
    }
  }

  pickOrigin(p: GeoPlace): void {
    p = this.asPlace(p);
    this.origin.set(p);
    this.originInfo.set(null);
    this.originQuery = p.name;
    this.originSuggestions.set([]);
    this.activeField.set(null);
    void this.tryPlan();
  }

  /** Nombre completo para el campo: «Panadería X, Av. Perú, San Martín de Porres». */
  private asPlace(p: GeoPlace | PlaceResult): GeoPlace {
    const r = p as PlaceResult;
    const name = r.kind && r.kind !== 'saved' && r.kind !== 'recent' && r.detail ? `${r.name}, ${r.detail}` : p.name;
    return { name, lat: p.lat, lng: p.lng };
  }

  pickDest(p: GeoPlace): void {
    p = this.asPlace(p);
    this.places.addRecent(p);
    this.savingPlace.set(false);
    this.destCategory.set(null);
    this.destNoResults.set(false);
    this.destination.set(p);
    this.destQuery = p.name;
    this.destSuggestions.set([]);
    this.activeField.set(null);
    void this.tryPlan();
  }

  pickQuickCity(c: GeoPlace): void {
    if (!this.origin()) {
      this.pickOrigin(c);
    } else if (!this.destination()) {
      this.pickDest(c);
    } else {
      this.pickDest(c);
    }
  }

  swapPlaces(): void {
    const o = this.origin();
    const d = this.destination();
    if (!o || !d) return;
    this.origin.set(d);
    this.destination.set(o);
    this.originQuery = d.name;
    this.destQuery = o.name;
    void this.tryPlan();
  }

  async tryPlan(): Promise<void> {
    const o = this.origin();
    const d = this.destination();
    if (!o || !d) {
      // Falta un punto: se muestra el que ya está para que el usuario lo vea y pueda ajustarlo.
      this.drawPins();
      const one = o ?? d;
      if (one && this.map) this.map.setView([one.lat, one.lng], Math.max(this.map.getZoom(), 13));
      return;
    }

    this.planning.set(true);
    this.formError.set(null);
    try {
      const list = await this.routing.planAlternatives(o, d);
      this.plans.set(list);
      this.selectedPlan.set(0);
      this.drawPlans();
    } catch (e) {
      this.plans.set([]);
      this.formError.set(e instanceof Error ? e.message : 'Error al calcular ruta');
    } finally {
      this.planning.set(false);
    }
  }

  fare(): number {
    const p = this.plan();
    if (!p) return 0;
    return Math.round(p.distanceKm * 2.8 * 100) / 100;
  }

  /** 1.12 → "12 % más"; 0.95 → "5 % menos". */
  pctLabel(ratio: number): string {
    const pct = Math.round((ratio - 1) * 100);
    return pct >= 0 ? `${pct} % más` : `${-pct} % menos`;
  }

  barPct(min: number, h: { porFranja?: { prediccionMin: number }[] }): number {
    const max = Math.max(...(h.porFranja ?? []).map((f) => f.prediccionMin), 1);
    return Math.max(8, Math.round((min / max) * 100));
  }

  formatDuration(min: number): string {
    min = Math.round(min);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  async createRoute(): Promise<void> {
    const p = this.plan();
    const o = this.origin();
    const d = this.destination();
    if (!p || !o || !d) return;

    this.creating.set(true);
    this.formError.set(null);
    try {
      await this.auth.refreshProfile();

      const vehicleId = this.selectedVehicleId || null;

      const route = await this.navRoutes.create({
        origin: o,
        destination: d,
        plan: p,
        vehicleId
      });
      this.selectedRouteId.set(route.id);
      this.showRouteOnMap(route);
      await this.navRoutes.load();
      await this.fleet.load(true);
      this.origin.set(null);
      this.destination.set(null);
      this.originQuery = '';
      this.destQuery = '';
      this.plans.set([]);
      this.selectedVehicleId = '';
      this.clearMapOverlays();
      // La siguiente ruta vuelve a partir de tu ubicación actual.
      void this.useMyLocation(true);
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo crear la ruta'));
    } finally {
      this.creating.set(false);
    }
  }

  showRouteOnMap(r: NavRoute): void {
    this.selectedRouteId.set(r.id);
    if (!this.map || !r.geometry?.length) {
      this.drawSimpleRoute(r);
      return;
    }
    this.drawPlan({
      origin: { name: r.originName, lat: r.originLat, lng: r.originLng },
      destination: { name: r.destName, lat: r.destLat, lng: r.destLng },
      label: r.routeLabel,
      distanceKm: r.distanceKm ?? 0,
      durationMin: r.durationMin ?? 0,
      coordinates: r.geometry
    });
  }

  async setStatus(r: NavRoute, status: NavRouteStatus, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      await this.navRoutes.updateStatus(r.id, status);
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  async cancelRoute(r: NavRoute, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      await this.navRoutes.cancel(r.id);
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  async deleteRoute(r: NavRoute, e: Event): Promise<void> {
    e.stopPropagation();
    if (!(await this.confirmDialog.ask(`¿Eliminar ruta ${r.routeLabel}?`))) return;
    try {
      await this.navRoutes.delete(r.id);
      if (this.selectedRouteId() === r.id) {
        this.selectedRouteId.set(null);
        this.clearMapOverlays();
      }
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  /** Dibuja todas las alternativas; la seleccionada encima y resaltada. */
  private drawPlans(): void {
    const list = this.plans();
    const sel = list[this.selectedPlan()];
    if (!this.map || !sel) return;
    this.drawPlan(sel);
    list.forEach((alt, i) => {
      if (i === this.selectedPlan() || !this.map) return;
      const line = L.polyline(alt.coordinates, { color: this.altColor(i), weight: 4, opacity: 0.45, dashArray: '6 6' })
        .bindTooltip(`Alternativa: ${alt.distanceKm} km · ${this.formatDuration(alt.durationTrafficMin ?? alt.durationMin)}`)
        .on('click', () => this.selectPlan(i))
        .addTo(this.map);
      line.bringToBack();
      this.altLines.push(line);
    });
  }

  private drawPlan(p: RoutePlan): void {
    if (!this.map) return;
    this.clearMapOverlays();

    this.routeLine = L.polyline(p.coordinates, {
      color: this.altColor(this.plan() === p ? this.selectedPlan() : 0),
      weight: 5,
      opacity: 0.85
    }).addTo(this.map);

    if (this.plans().includes(p)) {
      // Planificación en curso: puntos arrastrables.
      this.drawPins();
    } else {
      // Ruta ya guardada: sólo referencia.
      this.originMarker = L.marker([p.origin.lat, p.origin.lng], { icon: this.pinIcon('#10b981', 'Origen') }).bindTooltip('Origen').addTo(this.map);
      this.destMarker = L.marker([p.destination.lat, p.destination.lng], { icon: this.pinIcon('#ef4444', 'Destino') }).bindTooltip('Destino').addTo(this.map);
    }

    this.fitVisible(this.routeLine.getBounds().pad(0.12));
  }

  private drawSimpleRoute(r: NavRoute): void {
    if (!this.map) return;
    this.clearMapOverlays();
    const coords: [number, number][] = [
      [r.originLat, r.originLng],
      [r.destLat, r.destLng]
    ];
    this.routeLine = L.polyline(coords, { color: '#2563eb', weight: 4, dashArray: '8 8' }).addTo(this.map);
    this.fitVisible(L.latLngBounds(coords).pad(0.2));
  }

  private clearMapOverlays(): void {
    this.altLines.forEach((l) => l.remove());
    this.altLines = [];
    this.routeLine?.remove();
    this.originMarker?.remove();
    this.destMarker?.remove();
    this.routeLine = null;
    this.originMarker = null;
    this.destMarker = null;
  }
}
