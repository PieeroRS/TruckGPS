import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje legible desde errores del API FastAPI. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : JSON.stringify(item)))
        .join('; ');
    }
    if (err.status === 0) return 'No se pudo conectar con el servidor. ¿Está corriendo el backend en el puerto 8000?';
    if (err.status === 401) return 'Sesión expirada. Vuelve a iniciar sesión.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
