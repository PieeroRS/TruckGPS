import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`));
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body));
  }

  postForm<T>(path: string, body: FormData): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.baseUrl}${path}`, body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.baseUrl}${path}`));
  }
}
