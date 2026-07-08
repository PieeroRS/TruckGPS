import { environment } from '../../../environments/environment';

export function isSupabaseConfigured(): boolean {
  const url = environment.supabaseUrl?.trim() ?? '';
  const key = environment.supabaseAnonKey?.trim() ?? '';
  return url.length > 0 && key.length > 0 && url.startsWith('https://');
}

export const STORAGE_BUCKETS = {
  photos: 'incident-photos',
  audio: 'incident-audio'
} as const;
