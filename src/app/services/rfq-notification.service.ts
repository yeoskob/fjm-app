import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

export const NOTIF_ROLES_KEY = 'rfq_notif_roles';
export const DEFAULT_NOTIF_ROLES = ['admin', 'manager'];

export interface NotificationItem {
  id: string;
  type: 'price_approval' | 'price_review';
  inquiryId: string;
  rfqNo?: string;
  message: string;
  triggeredByName: string;
  createdAt: string;
}

interface RawNotification {
  id: string;
  type: string;
  inquiry_id: string;
  rfq_no: string | null;
  message: string;
  triggered_by: string;
  triggered_by_name: string;
  created_at: string;
  read_at: string | null;
}

function toItem(r: RawNotification): NotificationItem {
  return {
    id: r.id,
    type: r.type as NotificationItem['type'],
    inquiryId: r.inquiry_id,
    rfqNo: r.rfq_no ?? undefined,
    message: r.message,
    triggeredByName: r.triggered_by_name,
    createdAt: r.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class RfqNotificationService implements OnDestroy {
  private readonly base = `${environment.apiUrl}/notifications`;
  private notifRoles: string[] = [...DEFAULT_NOTIF_ROLES];
  private eventSource?: EventSource;
  private items: NotificationItem[] = [];

  readonly visible$ = new BehaviorSubject<NotificationItem[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private settingsService: SettingsService,
  ) {}

  async start(): Promise<void> {
    await this.loadRoles();
    if (!this.isEligible()) return;
    await this.fetchUnread();
    this.connectSSE();
  }

  stop(): void {
    this.closeSSE();
    this.items = [];
    this.visible$.next([]);
  }

  async dismissAll(): Promise<void> {
    const ids = this.items.map(n => n.id);
    this.items = [];
    this.visible$.next([]);
    // Fire-and-forget — mark all as read on server
    try {
      await firstValueFrom(this.http.post(`${this.base}/read-all`, {}));
    } catch { /* best-effort */ }
    void ids; // silence unused warning
  }

  /** Called by the settings page after saving new roles. */
  setRoles(roles: string[]): void {
    this.notifRoles = roles.length > 0 ? roles : [...DEFAULT_NOTIF_ROLES];
    if (!this.isEligible()) {
      this.stop();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private isEligible(): boolean {
    const role = this.authService.getCurrentUser()?.role;
    return !!role && this.notifRoles.includes(role);
  }

  private async fetchUnread(): Promise<void> {
    try {
      const raw = await firstValueFrom(this.http.get<RawNotification[]>(this.base));
      this.items = raw.map(toItem);
      this.visible$.next([...this.items]);
    } catch { /* silent */ }
  }

  private connectSSE(): void {
    this.closeSSE();

    const token = this.authService.getToken();
    if (!token) return;

    const url = `${this.base}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    this.eventSource = es;

    // On (re)connect: re-fetch unread so nothing is missed while offline
    es.addEventListener('open', () => void this.fetchUnread());

    es.addEventListener('message', (event: MessageEvent<string>) => {
      if (!this.isEligible()) return;
      try {
        const raw = JSON.parse(event.data) as RawNotification;
        const item = toItem(raw);
        // Deduplicate — SSE fires after the insert so fetchUnread might have it already
        if (!this.items.find(n => n.id === item.id)) {
          this.items = [item, ...this.items];
          this.visible$.next([...this.items]);
        }
      } catch { /* ignore malformed events */ }
    });

    es.addEventListener('error', () => {
      // EventSource auto-reconnects; nothing to do here
    });
  }

  private closeSSE(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  private async loadRoles(): Promise<void> {
    try {
      const all = await this.settingsService.getAll();
      const raw = all[NOTIF_ROLES_KEY];
      if (raw) this.notifRoles = JSON.parse(raw) as string[];
    } catch { /* use defaults */ }
  }
}
