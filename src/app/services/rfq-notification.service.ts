import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

export const NOTIF_EVENTS_KEY = 'rfq_notif_events';
export const LEGACY_NOTIF_ROLES_KEY = 'rfq_notif_roles';
export const NOTIF_ROLES_KEY = LEGACY_NOTIF_ROLES_KEY;

export type NotificationType =
  | 'price_approval'
  | 'price_review'
  | 'price_approved'
  | 'return_to_sourcing'
  | 'assigned_sales'
  | 'assigned_sourcing';

export const NOTIF_TYPES: NotificationType[] = [
  'price_approval',
  'price_review',
  'price_approved',
  'return_to_sourcing',
  'assigned_sales',
  'assigned_sourcing',
];

export const NOTIF_TYPE_LABELS: Record<NotificationType, string> = {
  price_approval: 'Price Approval (new submission)',
  price_review: 'Price Review (sent back)',
  price_approved: 'Price Approved (quotation ready)',
  return_to_sourcing: 'Returned to Sourcing',
  assigned_sales: 'Assigned as Sales PIC',
  assigned_sourcing: 'Assigned as Sourcing PIC',
};

export const DEFAULT_NOTIF_EVENTS: Record<NotificationType, string[]> = {
  price_approval: ['admin', 'manager'],
  price_review: ['admin', 'manager'],
  price_approved: ['marketing'],
  return_to_sourcing: ['sourcing'],
  assigned_sales: ['marketing'],
  assigned_sourcing: ['sourcing'],
};

export const DEFAULT_NOTIF_ROLES = ['admin', 'manager'];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  inquiryId: string;
  rfqNo?: string;
  message: string;
  triggeredByName: string;
  createdAt: string;
  recipientUsername?: string;
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
  recipient_username?: string | null;
}

function toItem(r: RawNotification): NotificationItem {
  return {
    id: r.id,
    type: r.type as NotificationType,
    inquiryId: r.inquiry_id,
    rfqNo: r.rfq_no ?? undefined,
    message: r.message,
    triggeredByName: r.triggered_by_name,
    createdAt: r.created_at,
    recipientUsername: r.recipient_username ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class RfqNotificationService implements OnDestroy {
  private readonly base = `${environment.apiUrl}/notifications`;
  private notifEvents: Record<NotificationType, string[]> = { ...DEFAULT_NOTIF_EVENTS };
  private eventSource?: EventSource;
  private items: NotificationItem[] = [];
  private started = false;

  readonly visible$ = new BehaviorSubject<NotificationItem[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private settingsService: SettingsService,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    await this.loadSettings();
    if (!this.hasAnyEligibleType()) return;
    this.started = true;
    await this.fetchUnread();
    this.connectSSE();
  }

  stop(): void {
    this.started = false;
    this.closeSSE();
    this.items = [];
    this.visible$.next([]);
  }

  async dismissAll(): Promise<void> {
    this.items = [];
    this.visible$.next([]);
    try {
      await firstValueFrom(this.http.post(`${this.base}/read-all`, {}));
    } catch { /* best-effort */ }
  }

  /** Called by the settings page after saving the event→roles matrix. */
  setEvents(events: Record<NotificationType, string[]>): void {
    this.notifEvents = { ...DEFAULT_NOTIF_EVENTS, ...events };
    if (!this.hasAnyEligibleType()) {
      this.stop();
    } else if (!this.started) {
      void this.start();
    } else {
      // refilter the current set against new eligibility
      this.items = this.items.filter(i => this.isEligibleFor(i.type));
      this.visible$.next([...this.items]);
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private currentRole(): string | undefined {
    return this.authService.getCurrentUser()?.role;
  }

  private isEligibleFor(type: NotificationType): boolean {
    const role = this.currentRole();
    if (!role) return false;
    const roles = this.notifEvents[type] ?? [];
    return roles.includes(role);
  }

  private hasAnyEligibleType(): boolean {
    return NOTIF_TYPES.some(t => this.isEligibleFor(t));
  }

  private async fetchUnread(): Promise<void> {
    try {
      const raw = await firstValueFrom(this.http.get<RawNotification[]>(this.base));
      this.items = raw.map(toItem).filter(i => this.isEligibleFor(i.type));
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
    let firstOpen = true;

    es.addEventListener('open', () => {
      if (firstOpen) { firstOpen = false; void this.fetchUnread(); }
    });

    es.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const raw = JSON.parse(event.data) as RawNotification;
        const item = toItem(raw);
        if (!this.isEligibleFor(item.type)) return;
        if (!this.items.find(n => n.id === item.id)) {
          this.items = [item, ...this.items];
          this.visible$.next([...this.items]);
        }
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('error', () => { /* auto-reconnect */ });
  }

  private closeSSE(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  private async loadSettings(): Promise<void> {
    try {
      const all = await this.settingsService.getAll();
      const rawEvents = all[NOTIF_EVENTS_KEY];
      if (rawEvents) {
        const parsed = JSON.parse(rawEvents) as Partial<Record<NotificationType, string[]>>;
        this.notifEvents = { ...DEFAULT_NOTIF_EVENTS, ...parsed };
        return;
      }
      // Legacy fallback — old single-role list mapped to the two existing event types
      const rawLegacy = all[LEGACY_NOTIF_ROLES_KEY];
      if (rawLegacy) {
        const legacy = JSON.parse(rawLegacy) as string[];
        this.notifEvents = {
          ...DEFAULT_NOTIF_EVENTS,
          price_approval: legacy,
          price_review: legacy,
        };
      }
    } catch { /* use defaults */ }
  }
}
