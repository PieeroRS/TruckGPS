import { HttpClient, HttpResponse } from '@angular/common/http';
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

  /** Descarga un archivo (PDF, Excel) con la sesión y lo guarda con el nombre que da el servidor. */
  async download(path: string, fallbackName: string): Promise<void> {
    let res: HttpResponse<Blob>;
    try {
      res = await firstValueFrom(this.http.get(`${this.baseUrl}${path}`, { observe: 'response', responseType: 'blob' }));
    } catch (e) {
      // Con responseType blob el detalle del error llega como Blob: se lee para mostrar el mensaje.
      const body = (e as { error?: unknown }).error;
      let detail: string | undefined;
      if (body instanceof Blob) {
        try {
          detail = (JSON.parse(await body.text()) as { detail?: string }).detail;
        } catch {
          detail = undefined;
        }
      }
      if (detail) throw new Error(detail);
      throw e;
    }
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(res.body as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
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

  put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.baseUrl}${path}`, body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.baseUrl}${path}`));
  }
}
