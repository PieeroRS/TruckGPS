import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { isSupabaseConfigured } from './supabase.config';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient | null = isSupabaseConfigured()
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
    : null;

  get isConfigured(): boolean {
    return this.client !== null;
  }
}
