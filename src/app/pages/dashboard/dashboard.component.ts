import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { DashboardStats, UserStats } from '../../models/inquiry';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  dashboard: DashboardStats | null = null;
  isAdmin = false;
  activeTab: 'sales' | 'sourcing' = 'sales';

  // User search
  users: Array<{ id: string; name: string; username: string; role: string }> = [];
  searchQuery = '';
  selectedUser: { id: string; name: string; username: string; role: string } | null = null;
  userStats: UserStats | null = null;
  loadingUser = false;

  readonly PIE_R = 40;
  readonly PIE_C = 2 * Math.PI * 40;

  get marketingBreakdown() {
    const rows = this.dashboard?.statusBreakdown ?? [];
    return rows.filter((s) => !['deal', 'lost'].includes(s.status));
  }

  userMarketingBreakdown(stats: UserStats) {
    return (stats.salesStats.statusBreakdown ?? []).filter((s) => !['deal', 'lost'].includes(s.status));
  }

  get marketingPieData() {
    const rows = this.dashboard?.statusBreakdown ?? [];
    return this.buildMarketingPie(rows, this.dashboard?.sentIncomplete ?? 0);
  }

  get itemPieData() {
    if (!this.dashboard) return null;
    const terisi = this.dashboard.itemsTerisi ?? 0;
    const tidakTerisi = this.dashboard.itemsTidakTerisi ?? 0;
    const missed = this.dashboard.itemsMissed ?? 0;
    const total = terisi + tidakTerisi + missed;
    if (total === 0) return null;

    const C = this.PIE_C;

    // Arc lengths
    const terisiDash = (terisi / total) * C;
    const tidakDash  = (tidakTerisi / total) * C;
    const missedDash = (missed / total) * C;

    // Gap = C - dash so the period = C (wraps the circle exactly once)
    const terisiGap = C - terisiDash;
    const tidakGap  = C - tidakDash;
    const missedGap = C - missedDash;

    // dashoffset = C - cumulative_previous (positive, positions each segment after the last)
    // Group is rotated -90° in the template so drawing starts at 12 o'clock
    const terisiOffset = 0;                              // first segment, starts at 12 o'clock
    const tidakOffset  = C - terisiDash;                 // starts after green
    const missedOffset = C - (terisiDash + tidakDash);   // starts after green + amber

    return {
      total, terisi, tidakTerisi, missed, C,
      terisiDash, terisiGap, terisiOffset,
      tidakDash,  tidakGap,  tidakOffset,
      missedDash, missedGap, missedOffset,
    };
  }

  userItemPieData(stats: UserStats) {
    const terisi = stats.sourcingStats.itemsTerisi ?? 0;
    const tidakTerisi = stats.sourcingStats.itemsTidakTerisi ?? 0;
    const missed = stats.sourcingStats.itemsMissed ?? 0;
    const total = terisi + tidakTerisi + missed;
    if (total === 0) return null;

    const C = this.PIE_C;
    const terisiDash = (terisi / total) * C;
    const tidakDash  = (tidakTerisi / total) * C;
    const missedDash = (missed / total) * C;

    return {
      total, terisi, tidakTerisi, missed, C,
      terisiDash,  terisiGap: C - terisiDash,  terisiOffset: 0,
      tidakDash,   tidakGap: C - tidakDash,    tidakOffset: C - terisiDash,
      missedDash,  missedGap: C - missedDash,  missedOffset: C - (terisiDash + tidakDash),
    };
  }

  userMarketingPieData(stats: UserStats) {
    return this.buildMarketingPie(stats.salesStats.statusBreakdown ?? [], stats.salesStats.sentIncomplete ?? 0);
  }

  private buildMarketingPie(rows: Array<{ status: string; count: number }>, sentIncomplete = 0) {
    const get = (status: string) => rows.find((r) => r.status === status)?.count ?? 0;

    const newInquiry = get('new_inquiry');
    const sentTotal = get('quotation_sent') + get('ready_to_purchase');
    const sentComplete = sentTotal - sentIncomplete;
    const total = newInquiry + sentTotal;
    if (total === 0) return null;

    const C = this.PIE_C;
    const newDash        = (newInquiry     / total) * C;
    const sentDash       = (sentComplete   / total) * C;
    const incompleteDash = (sentIncomplete / total) * C;

    return {
      total,
      newInquiry,
      sent: sentComplete,
      sentIncomplete,
      newDash,        newGap: C - newDash,        newOffset: 0,
      sentDash,       sentGap: C - sentDash,       sentOffset: C - newDash,
      incompleteDash, incompleteGap: C - incompleteDash,
      incompleteOffset: C - (newDash + sentDash),
    };
  }

  get filteredUsers() {
    const q = this.searchQuery.toLowerCase();
    const tabRole = this.activeTab === 'sales' ? 'marketing' : 'sourcing';
    return this.users.filter(
      (u) =>
        (u.role === tabRole || u.role === 'admin') &&
        (u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    );
  }

  setTab(tab: 'sales' | 'sourcing'): void {
    this.activeTab = tab;
    this.clearUser();
  }

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('admin');
    void this.load();
    if (this.isAdmin) void this.loadUsers();
  }

  async load(): Promise<void> {
    this.dashboard = await this.inquiryService.getDashboard();
  }

  async loadUsers(): Promise<void> {
    this.users = await this.inquiryService.getUsers();
  }

  async selectUser(user: (typeof this.users)[0]): Promise<void> {
    this.selectedUser = user;
    this.userStats = null;
    this.loadingUser = true;
    this.userStats = await this.inquiryService.getUserStats(user.name);
    this.loadingUser = false;
  }

  clearUser(): void {
    this.selectedUser = null;
    this.userStats = null;
    this.searchQuery = '';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      new_inquiry: 'New Inquiry',
      rfq: 'RFQ to Sourcing',
      price_approval: 'Price Approval',
      price_approved: 'Price Approved',
      quotation_sent: 'Quotation Sent',
      follow_up: 'Negotiation',
      deal: 'Deal',
      lost: 'Lost',
      ready_to_purchase: 'Ready to Purchase',
    };
    return map[status] ?? status;
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      marketing: 'Sales / Marketing',
      sourcing: 'Sourcing',
    };
    return map[role] ?? role;
  }
}
