import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';

import { SupabaseService } from '../core/supabase/supabase.service';
import { isSupabaseConfigured } from '../core/supabase/supabase.config';

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'conductor';
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly isLoggedIn = signal(false);
  readonly profile = signal<UserProfile | null>(null);
  readonly useSupabase = isSupabaseConfigured();

  isStaff(): boolean {
    const role = this.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  initials(): string {
    const name = this.profile()?.full_name?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  roleLabel(): string {
    const role = this.profile()?.role;
    if (role === 'admin') return 'Administrador';
    if (role === 'supervisor') return 'Supervisor';
    if (role === 'conductor') return 'Conductor';
    return 'Usuario';
  }

  async refreshProfile(): Promise<void> {
    if (!this.supabase.client) return;
    const { data } = await this.supabase.client.auth.getSession();
    if (data.session?.user) {
      await this.loadProfile(data.session.user);
    }
  }

  async updateOwnProfile(fullName: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.supabase.client) return { ok: false, error: 'Modo demo' };

    const { data: userData, error: userErr } = await this.supabase.client.auth.getUser();
    if (userErr || !userData.user) {
      return { ok: false, error: 'Sin sesión activa. Vuelve a iniciar sesión.' };
    }

    await this.loadProfile(userData.user);

    const id = this.profile()?.id ?? userData.user.id;
    const { error } = await this.supabase.client
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', id);

    if (error) return { ok: false, error: error.message };

    await this.loadProfile(userData.user);
    return { ok: true };
  }

  async initSession(): Promise<void> {
    if (!this.supabase.client) return;

    const { data } = await this.supabase.client.auth.getSession();
    const session = data.session;
    this.isLoggedIn.set(!!session);

    if (session?.user) {
      await this.loadProfile(session.user);
    }

    this.supabase.client.auth.onAuthStateChange(async (_event, sess) => {
      this.isLoggedIn.set(!!sess);
      if (sess?.user) {
        await this.loadProfile(sess.user);
      } else {
        this.profile.set(null);
      }
    });
  }

  async ensureSession(): Promise<boolean> {
    if (!this.supabase.client) {
      return this.isLoggedIn();
    }

    const { data } = await this.supabase.client.auth.getSession();
    const ok = !!data.session;
    this.isLoggedIn.set(ok);

    if (ok && data.session?.user) {
      await this.loadProfile(data.session.user);
    }

    return ok;
  }

  async login(identifier: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.supabase.client) {
      const demo = identifier === 'camionessa' && password === 'password';
      this.isLoggedIn.set(demo);
      return demo ? { ok: true } : { ok: false, error: 'Credenciales inválidas. Usa camionessa / password.' };
    }

    const email = identifier.includes('@') ? identifier : `${identifier}@truckgps.pe`;
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });

    if (error) {
      return { ok: false, error: error.message };
    }

    this.isLoggedIn.set(!!data.session);
    if (data.user) {
      await this.loadProfile(data.user);
    }
    return { ok: true };
  }

  async logout(): Promise<void> {
    if (this.supabase.client) {
      await this.supabase.client.auth.signOut();
    }
    this.isLoggedIn.set(false);
    this.profile.set(null);
    await this.router.navigateByUrl('/login');
  }

  private async loadProfile(user: User): Promise<void> {
    if (!this.supabase.client) return;

    const { data, error } = await this.supabase.client.rpc('ensure_user_profile');
    if (!error && data) {
      this.profile.set(data as UserProfile);
      return;
    }

    const { data: row, error: selectErr } = await this.supabase.client
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!selectErr && row) {
      this.profile.set(row as UserProfile);
      return;
    }

    const meta = user.user_metadata ?? {};
    this.profile.set({
      id: user.id,
      full_name: (meta['full_name'] as string) ?? user.email?.split('@')[0] ?? 'Usuario',
      email: user.email ?? '',
      role: (meta['role'] as UserProfile['role']) ?? 'conductor'
    });
  }
}
