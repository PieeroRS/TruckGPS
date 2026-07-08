/** Mensaje legible desde errores de Supabase (no son instancias de Error). */
export function supabaseErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) {
      if (msg.includes('nav_routes') && (msg.includes('PGRST205') || msg.includes('Could not find'))) {
        return 'Falta crear la tabla nav_routes en Supabase. Ejecuta supabase/migrations/006_nav_routes.sql en SQL Editor y recarga la página.';
      }
      if (msg.includes('permission denied') || msg.includes('42501')) {
        return 'Permiso denegado. Cierra sesión, vuelve a entrar como supervisor e intenta de nuevo.';
      }
      return msg;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
