import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { NotificationLogRow, NotificationStatus, RiskZone, RiskZoneUpsert } from '../models/zone.model';

@Injectable({ providedIn: 'root' })
export class ZonesService {
  private readonly api = inject(ApiService);

  readonly zones = signal<RiskZone[]>([]);

  async loadZones(): Promise<RiskZone[]> {
    const rows = await this.api.get<RiskZone[]>('/zones');
    this.zones.set(rows);
    return rows;
  }

  create(body: RiskZoneUpsert): Promise<RiskZone> {
    return this.api.post<RiskZone>('/zones', body);
  }

  update(id: string, body: RiskZoneUpsert): Promise<RiskZone> {
    return this.api.patch<RiskZone>(`/zones/${id}`, body);
  }

  remove(id: string): Promise<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/zones/${id}`);
  }

  status(): Promise<NotificationStatus> {
    return this.api.get<NotificationStatus>('/notifications/status');
  }

  history(limit = 50): Promise<NotificationLogRow[]> {
    return this.api.get<NotificationLogRow[]>(`/notifications?limit=${limit}`);
  }

  sendTest(): Promise<NotificationLogRow[]> {
    return this.api.post<NotificationLogRow[]>('/notifications/test');
  }
}
