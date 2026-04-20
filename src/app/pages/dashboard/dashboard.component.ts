import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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

  private readonly PIPELINE_STATUSES = [
    'new_inquiry', 'rfq', 'price_approval', 'price_approved', 'quotation_sent',
  ];

  get marketingBreakdown() {
    const rows = this.dashboard?.statusBreakdown ?? [];
    return this.PIPELINE_STATUSES.map((status) => ({
      status,
      count: rows.find((r) => r.status === status)?.count ?? 0,
    }));
  }

  userMarketingBreakdown(stats: UserStats) {
    const rows = stats.salesStats.statusBreakdown ?? [];
    return this.PIPELINE_STATUSES.map((status) => ({
      status,
      count: rows.find((r) => r.status === status)?.count ?? 0,
    }));
  }

  get sourcingFillRate(): number {
    if (!this.dashboard) return 0;
    const filled = this.dashboard.itemsTerisi ?? 0;
    const unfilled = this.dashboard.itemsTidakTerisi ?? 0;
    const base = filled + unfilled;
    return base > 0 ? +((filled / base) * 100).toFixed(1) : 0;
  }

  get marketingConversionRate(): number {
    if (!this.dashboard?.total) return 0;
    return +((this.dashboard.quotationSent / this.dashboard.total) * 100).toFixed(1);
  }

  get funnelData() {
    if (!this.dashboard) return [];
    const rows = this.dashboard.statusBreakdown ?? [];
    const get = (s: string) => rows.find((r) => r.status === s)?.count ?? 0;
    const base = this.dashboard.total || 1;
    const steps = [
      { label: 'New Inquiry',    count: get('new_inquiry'),                               color: '#1d4ed8', route: '/marketing',  tab: 'rfq'           },
      { label: 'Sourcing',       count: get('rfq'),                                       color: '#7c3aed', route: '/sourcing',   tab: 'rfq'           },
      { label: 'Price Approval', count: get('price_approval'),                            color: '#c2410c', route: '/pricelist',  tab: null            },
      { label: 'Price Approved', count: get('price_approved'),                            color: '#d97706', route: '/marketing',  tab: 'price_approved'},
      { label: 'Sent',           count: get('quotation_sent') + get('ready_to_purchase'), color: '#15803d', route: '/marketing',  tab: 'sent'          },
    ];
    return steps.map((s) => ({ ...s, pct: Math.round((s.count / base) * 100) }));
  }

  get marketingPieData() {
    const rows = this.dashboard?.statusBreakdown ?? [];
    return this.buildMarketingPie(rows, this.dashboard?.unsent ?? 0);
  }

  get itemPieData() {
    if (!this.dashboard) return null;
    const terisi = this.dashboard.itemsTerisi ?? 0;
    const tidakTerisi = this.dashboard.itemsTidakTerisi ?? 0;
    const missedAll = this.dashboard.itemsMissed ?? 0;
    const missedUnassigned = this.dashboard.itemsMissedUnassigned ?? 0;
    const missedAssigned = missedAll - missedUnassigned;
    const total = terisi + tidakTerisi + missedAll;
    if (total === 0) return null;

    const C = this.PIE_C;
    const terisiDash          = (terisi          / total) * C;
    const tidakDash           = (tidakTerisi      / total) * C;
    const missedAssignedDash  = (missedAssigned   / total) * C;
    const missedUnassignedDash = (missedUnassigned / total) * C;

    const terisiOffset           = 0;
    const tidakOffset            = C - terisiDash;
    const missedAssignedOffset   = C - (terisiDash + tidakDash);
    const missedUnassignedOffset = C - (terisiDash + tidakDash + missedAssignedDash);

    return {
      total, terisi, tidakTerisi, missedAssigned, missedUnassigned, C,
      terisiDash,           terisiGap: C - terisiDash,                     terisiOffset,
      tidakDash,            tidakGap: C - tidakDash,                       tidakOffset,
      missedAssignedDash,   missedAssignedGap: C - missedAssignedDash,     missedAssignedOffset,
      missedUnassignedDash, missedUnassignedGap: C - missedUnassignedDash, missedUnassignedOffset,
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
    return this.buildMarketingPie(stats.salesStats.statusBreakdown ?? [], stats.salesStats.unsent ?? 0);
  }

  userConversionRate(stats: UserStats): number {
    const total = stats.salesStats.total || 0;
    if (!total) return 0;
    return +((stats.salesStats.quotationSent / total) * 100).toFixed(1);
  }

  userMissedRate(stats: UserStats): number {
    const base = (stats.sourcingStats.itemsTerisi ?? 0) + (stats.sourcingStats.itemsMissed ?? 0);
    if (!base) return 0;
    return +((( stats.sourcingStats.itemsMissed ?? 0) / base) * 100).toFixed(1);
  }

  userSourcingFillRate(stats: UserStats): number {
    const filled = stats.sourcingStats.itemsTerisi ?? 0;
    const unfilled = stats.sourcingStats.itemsTidakTerisi ?? 0;
    const base = filled + unfilled;
    return base > 0 ? +((filled / base) * 100).toFixed(1) : 0;
  }

  private buildMarketingPie(rows: Array<{ status: string; count: number }>, _unsent = 0) {
    const get = (status: string) => rows.find((r) => r.status === status)?.count ?? 0;

    const newInquiry  = get('new_inquiry');
    const inPipeline  = get('rfq') + get('price_approval') + get('price_approved');
    const sentTotal   = get('quotation_sent') + get('ready_to_purchase');
    const unsent      = get('unsent');
    const total = newInquiry + inPipeline + sentTotal + unsent;
    if (total === 0) return null;

    const C = this.PIE_C;
    const newDash      = (newInquiry / total) * C;
    const pipelineDash = (inPipeline / total) * C;
    const sentDash     = (sentTotal  / total) * C;
    const unsentDash   = (unsent     / total) * C;

    return {
      total, newInquiry, inPipeline, sent: sentTotal, unsent,
      newDash,      newGap: C - newDash,      newOffset: 0,
      pipelineDash, pipelineGap: C - pipelineDash, pipelineOffset: C - newDash,
      sentDash,     sentGap: C - sentDash,     sentOffset: C - (newDash + pipelineDash),
      unsentDash,   unsentGap: C - unsentDash, unsentOffset: C - (newDash + pipelineDash + sentDash),
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

  constructor(private inquiryService: InquiryService, private authService: AuthService, private router: Router) {}

  navigateToStep(step: { route: string | null; tab: string | null }): void {
    if (!step.route) return;
    void this.router.navigate([step.route], step.tab ? { queryParams: { tab: step.tab } } : {});
  }

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
