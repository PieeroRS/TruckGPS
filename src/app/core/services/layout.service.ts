import { Injectable, signal } from '@angular/core';

export interface PageMeta {
  title: string;
  subtitle: string;
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly pageMeta = signal<PageMeta>({
    title: 'Dashboard',
    subtitle: 'Centro de control · Operaciones en tiempo real'
  });

  setPage(title: string, subtitle: string): void {
    this.pageMeta.set({ title, subtitle });
  }
}
