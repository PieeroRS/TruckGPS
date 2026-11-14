import { Component, HostListener, inject } from '@angular/core';

import { ConfirmService } from '../services/confirm.service';

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  template: `
    @if (svc.current(); as req) {
      <div class="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]" (click)="svc.answer(false)">
        <div
          class="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="req.message"
          (click)="$event.stopPropagation()"
        >
          <p class="text-[14px] font-semibold text-slate-900 leading-snug">{{ req.message }}</p>
          <div class="flex gap-2 mt-5">
            <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50" (click)="svc.answer(false)">
              Cancelar
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 rounded-lg text-white text-[13px] font-semibold"
              [class]="req.danger ? 'flex-1 py-2.5 rounded-lg text-white text-[13px] font-semibold bg-red-600 hover:bg-red-700' : 'flex-1 py-2.5 rounded-lg text-white text-[13px] font-semibold bg-[#0b1220] hover:bg-[#16233b]'"
              (click)="svc.answer(true)"
              autofocus
            >
              {{ req.okLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  readonly svc = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.svc.current()) this.svc.answer(false);
  }
}
