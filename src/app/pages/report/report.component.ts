import { Component, OnInit, HostListener } from '@angular/core';
import { InquiryService } from '../../services/inquiry.service';
import { Inquiry, ReportData, ReportRow, ReportSourcingData, ReportSourcingRow, INQUIRY_STATUS_LABELS } from '../../models/inquiry';

type ReportTab = 'marketing' | 'sourcing';

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
})
export class ReportComponent implements OnInit {
  activeTab: ReportTab = 'marketing';

  // ── Marketing tab ────────────────────────────────────────────────
  mData: ReportData | null = null;
  mLoading = false;
  mError = '';
  mSelectedMonth = '';
  mSelectedSalesPic = '';
  mSelectedStatus = '';
  mSearch = '';
  mSortCol: keyof ReportRow | '' = 'tanggal';
  mSortDir: 'asc' | 'desc' = 'desc';
  mUserDropdownOpen = false;
  mUserSearch = '';
  mPage = 1;

  // ── Sourcing tab ─────────────────────────────────────────────────
  sData: ReportSourcingData | null = null;
  sLoading = false;
  sError = '';
  sSelectedMonth = '';
  sSelectedSourcingPic = '';
  sSelectedStatus = '';
  sSearch = '';
  sSortCol: keyof ReportSourcingRow | '' = 'tanggal';
  sSortDir: 'asc' | 'desc' = 'desc';
  sUserDropdownOpen = false;
  sUserSearch = '';
  sPage = 1;

  // ── Users ────────────────────────────────────────────────────────
  marketingUsers: string[] = [];
  sourcingUsers: string[] = [];

  readonly PAGE_SIZE = 20;
  exporting = false;
  detailInquiry: Inquiry | null = null;
  detailLoading = false;

  readonly months: { value: string; label: string }[] = (() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      result.push({ value, label });
    }
    return result;
  })();

  readonly MARKETING_STATUS_OPTIONS = [
    { value: 'new_inquiry',       label: 'New Inquiry' },
    { value: 'rfq',               label: 'RFQ to Sourcing' },
    { value: 'price_approval',    label: 'Price Approval' },
    { value: 'price_approved',    label: 'Price Approved' },
    { value: 'quotation_sent',    label: 'Quotation Sent' },
    { value: 'follow_up',         label: 'Negotiation' },
    { value: 'ready_to_purchase', label: 'Ready to Purchase' },
    { value: 'unsent',            label: 'Unsent' },
  ];

  readonly SOURCING_STATUS_OPTIONS = [
    { value: 'rfq',               label: 'RFQ to Sourcing' },
    { value: 'price_approval',    label: 'Price Approval' },
    { value: 'price_approved',    label: 'Price Approved' },
    { value: 'quotation_sent',    label: 'Quotation Sent' },
    { value: 'ready_to_purchase', label: 'Ready to Purchase' },
    { value: 'missed',            label: 'Missed' },
  ];

  constructor(private inquiryService: InquiryService) {}

  ngOnInit(): void {
    void this.init();
  }

  async init(): Promise<void> {
    const users = await this.inquiryService.getUsers();
    this.marketingUsers = users.filter((u) => u.role === 'marketing').map((u) => u.name).sort();
    this.sourcingUsers  = users.filter((u) => u.role === 'sourcing').map((u) => u.name).sort();
    void this.loadMarketing();
    void this.loadSourcing();
  }

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
    this.mUserDropdownOpen = false;
    this.sUserDropdownOpen = false;
  }

  // ── Marketing ────────────────────────────────────────────────────
  async loadMarketing(): Promise<void> {
    this.mLoading = true; this.mError = '';
    try {
      this.mData = await this.inquiryService.getReport(
        this.mSelectedMonth || undefined,
        this.mSelectedSalesPic || undefined
      );
    } catch { this.mError = 'Failed to load report.'; }
    finally { this.mLoading = false; }
  }

  onMFilterChange(): void { this.mPage = 1; void this.loadMarketing(); }

  get mFilteredUsers(): string[] {
    const q = this.mUserSearch.toLowerCase();
    return q ? this.marketingUsers.filter((u) => u.toLowerCase().includes(q)) : this.marketingUsers;
  }
  get mUserLabel(): string { return this.mSelectedSalesPic || 'Semua Marketing'; }
  openMUserDropdown(): void { this.mUserDropdownOpen = true; this.mUserSearch = ''; }
  selectMUser(name: string): void { this.mSelectedSalesPic = name; this.mUserDropdownOpen = false; this.mUserSearch = ''; this.mPage = 1; void this.loadMarketing(); }
  clearMUser(): void { this.mSelectedSalesPic = ''; this.mUserDropdownOpen = false; this.mUserSearch = ''; this.mPage = 1; void this.loadMarketing(); }

  setMSort(col: keyof ReportRow): void {
    if (this.mSortCol === col) { this.mSortDir = this.mSortDir === 'asc' ? 'desc' : 'asc'; }
    else { this.mSortCol = col; this.mSortDir = col === 'tanggal' ? 'desc' : 'asc'; }
    this.mPage = 1;
  }
  mSortIcon(col: keyof ReportRow): string {
    if (this.mSortCol !== col) return '↕';
    return this.mSortDir === 'asc' ? '↑' : '↓';
  }

  get mSortedRows(): ReportRow[] {
    if (!this.mData) return [];
    const col = this.mSortCol || 'tanggal';
    const dir = this.mSortDir === 'asc' ? 1 : -1;
    let rows = this.mSelectedStatus ? this.mData.rows.filter((r) => r.status === this.mSelectedStatus) : this.mData.rows;
    if (this.mSearch.trim()) {
      const q = this.mSearch.trim().toLowerCase();
      rows = rows.filter((r) => [r.rfq_no, r.customer, r.sales_pic, r.need_by_date, r.tanggal, this.statusLabel(r.status)].some((v) => v && String(v).toLowerCase().includes(q)));
    }
    return [...rows].sort((a, b) => {
      const av = a[col as keyof ReportRow] ?? ''; const bv = b[col as keyof ReportRow] ?? '';
      if (av === bv) return 0; if (!av) return 1; if (!bv) return -1;
      return av < bv ? -dir : dir;
    });
  }

  get mPagedRows(): ReportRow[] {
    const start = (this.mPage - 1) * this.PAGE_SIZE;
    return this.mSortedRows.slice(start, start + this.PAGE_SIZE);
  }
  get mTotalPages(): number { return Math.ceil(this.mSortedRows.length / this.PAGE_SIZE) || 1; }

  mCountByStatus(...statuses: string[]): number {
    return this.mSortedRows.filter((r) => statuses.includes(r.status)).length;
  }

  // ── Sourcing ─────────────────────────────────────────────────────
  async loadSourcing(): Promise<void> {
    this.sLoading = true; this.sError = '';
    try {
      this.sData = await this.inquiryService.getSourcingReport(
        this.sSelectedMonth || undefined,
        this.sSelectedSourcingPic || undefined
      );
    } catch { this.sError = 'Failed to load sourcing report.'; }
    finally { this.sLoading = false; }
  }

  onSFilterChange(): void { this.sPage = 1; void this.loadSourcing(); }

  get sFilteredUsers(): string[] {
    const q = this.sUserSearch.toLowerCase();
    return q ? this.sourcingUsers.filter((u) => u.toLowerCase().includes(q)) : this.sourcingUsers;
  }
  get sUserLabel(): string { return this.sSelectedSourcingPic || 'Semua Sourcing'; }
  openSUserDropdown(): void { this.sUserDropdownOpen = true; this.sUserSearch = ''; }
  selectSUser(name: string): void { this.sSelectedSourcingPic = name; this.sUserDropdownOpen = false; this.sUserSearch = ''; this.sPage = 1; void this.loadSourcing(); }
  clearSUser(): void { this.sSelectedSourcingPic = ''; this.sUserDropdownOpen = false; this.sUserSearch = ''; this.sPage = 1; void this.loadSourcing(); }

  setSSSort(col: keyof ReportSourcingRow): void {
    if (this.sSortCol === col) { this.sSortDir = this.sSortDir === 'asc' ? 'desc' : 'asc'; }
    else { this.sSortCol = col; this.sSortDir = col === 'tanggal' ? 'desc' : 'asc'; }
    this.sPage = 1;
  }
  sSortIcon(col: keyof ReportSourcingRow): string {
    if (this.sSortCol !== col) return '↕';
    return this.sSortDir === 'asc' ? '↑' : '↓';
  }

  get sSortedRows(): ReportSourcingRow[] {
    if (!this.sData) return [];
    const col = this.sSortCol || 'tanggal';
    const dir = this.sSortDir === 'asc' ? 1 : -1;
    let rows = this.sSelectedStatus ? this.sData.rows.filter((r) => r.status === this.sSelectedStatus) : this.sData.rows;
    if (this.sSearch.trim()) {
      const q = this.sSearch.trim().toLowerCase();
      rows = rows.filter((r) => [r.rfq_no, r.customer, r.sales_pic, r.sourcing_pic, this.statusLabel(r.status)].some((v) => v && String(v).toLowerCase().includes(q)));
    }
    return [...rows].sort((a, b) => {
      const av = a[col as keyof ReportSourcingRow] ?? ''; const bv = b[col as keyof ReportSourcingRow] ?? '';
      if (av === bv) return 0; if (!av) return 1; if (!bv) return -1;
      return av < bv ? -dir : dir;
    });
  }

  get sPagedRows(): ReportSourcingRow[] {
    const start = (this.sPage - 1) * this.PAGE_SIZE;
    return this.sSortedRows.slice(start, start + this.PAGE_SIZE);
  }
  get sTotalPages(): number { return Math.ceil(this.sSortedRows.length / this.PAGE_SIZE) || 1; }

  sCountByStatus(...statuses: string[]): number {
    return this.sSortedRows.filter((r) => statuses.includes(r.status)).length;
  }

  sourcedPct(row: ReportSourcingRow): number {
    if (!row.total_items) return 0;
    return Math.round((row.sourced_items / row.total_items) * 100);
  }

  sourcedPctClass(row: ReportSourcingRow): string {
    const pct = this.sourcedPct(row);
    if (pct === 100) return 'pct-good';
    if (pct >= 50)   return 'pct-mid';
    return 'pct-bad';
  }

  // ── Shared ───────────────────────────────────────────────────────
  statusLabel(status: string): string {
    return INQUIRY_STATUS_LABELS[status as keyof typeof INQUIRY_STATUS_LABELS] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      quotation_sent: 'chip-sent', ready_to_purchase: 'chip-sent',
      unsent: 'chip-unsent', missed: 'chip-missed',
      price_approved: 'chip-approved', price_approval: 'chip-approval',
      rfq: 'chip-rfq', new_inquiry: 'chip-new', follow_up: 'chip-followup',
    };
    return map[status] ?? '';
  }

  timelineClass(days: number | null): string {
    if (days == null) return '';
    if (days >= 14) return 'tl-good';
    if (days >= 7)  return 'tl-mid';
    return 'tl-tight';
  }

  formatDate(d?: string | null): string {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async exportExcel(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      const month = this.activeTab === 'marketing' ? this.mSelectedMonth : this.sSelectedMonth;
      const salesPic = this.activeTab === 'marketing' ? this.mSelectedSalesPic : undefined;
      const status = this.activeTab === 'marketing' ? this.mSelectedStatus : this.sSelectedStatus;
      const blob = await this.inquiryService.exportReport(month || undefined, salesPic, status || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report${month ? '-' + month : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { this.exporting = false; }
  }

  async openDetail(id: string): Promise<void> {
    this.detailLoading = true; this.detailInquiry = null;
    try { this.detailInquiry = await this.inquiryService.getById(id); }
    finally { this.detailLoading = false; }
  }

  closeDetail(): void { this.detailInquiry = null; }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.user-dropdown-wrap')) {
      this.mUserDropdownOpen = false;
      this.sUserDropdownOpen = false;
    }
  }
}
