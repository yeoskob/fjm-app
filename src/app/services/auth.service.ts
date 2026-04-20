import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Role, User } from '../models/user';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly storageKey = 'fjm_current_user';
  private readonly apiBase = `${environment.apiUrl}`;
  private currentUser: User | null = null;
  private readonly onStorageChange = (event: StorageEvent): void => {
    if (event.key !== this.storageKey) {
      return;
    }
    this.currentUser = this.load();
  };

  constructor(private http: HttpClient) {
    this.currentUser = this.load();
    window.addEventListener('storage', this.onStorageChange);
  }

  async login(username: string, password: string): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
    try {
      const user = await firstValueFrom(
        this.http.post<User>(`${this.apiBase}/auth/login`, { username, password })
      );
      this.currentUser = user;
      this.persist();
      return { ok: true, user };
    } catch (error: any) {
      const message = error?.error?.error ?? 'Login failed.';
      return { ok: false, error: message };
    }
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem(this.storageKey);
  }

  updateCurrentUser(updated: User): void {
    if (this.currentUser?.id !== updated.id) {
      return;
    }
    this.currentUser = updated;
    this.persist();
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return Boolean(this.currentUser);
  }

  getToken(): string | null {
    return this.currentUser?.token ?? null;
  }

  hasMenu(menu: string): boolean {
    if (this.currentUser?.role === 'admin') return true;
    return this.currentUser?.menus?.includes(menu) ?? false;
  }

  hasTab(module: string, _tab: string): boolean {
    return this.hasMenu(module);
  }

  hasRole(role: Role): boolean {
    return this.currentUser?.role === role;
  }

  hasAnyRole(roles: Role[]): boolean {
    if (!this.currentUser) {
      return false;
    }
    return roles.includes(this.currentUser.role);
  }

  getLandingRoute(): string {
    if (!this.currentUser) {
      return '/login';
    }
    if (this.currentUser.role === 'admin') {
      return '/dashboard';
    }
    const menus = this.currentUser.menus ?? [];
    const priority = ['dashboard', 'marketing', 'sourcing', 'pricelist', 'purchasing'];
    for (const m of priority) {
      if (menus.includes(m)) return `/${m}`;
    }
    return '/not-authorized';
  }

  private load(): User | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as User;
      if (!parsed?.id) {
        return null;
      }
      const legacyRole = (parsed as { role?: string }).role;
      if (legacyRole === 'sales') {
        (parsed as User).role = 'marketing';
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.currentUser) {
      localStorage.removeItem(this.storageKey);
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorageChange);
  }
}
