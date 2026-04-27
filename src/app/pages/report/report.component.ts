import { Component, OnInit, HostListener } from '@angular/core';
import { InquiryService } from '../../services/inquiry.service';
import { Inquiry, InquiryItem, InquiryNote, ReportData, ReportRow, ReportSourcingData, ReportSourcingRow, INQUIRY_STATUS_LABELS } from '../../models/inquiry';
import { AuthService } from '../../services/auth.service';

type ReportTab = 'marketing' | 'sourcing' | 'purchasing';

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
  mDateField: 'tanggal' | 'need_by_date' = 'tanggal';
  mDateFrom = '';
  mDateTo = '';
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
  sDateField: 'tanggal' | 'need_by_date' = 'tanggal';
  sDateFrom = '';
  sDateTo = '';
  sSortCol: keyof ReportSourcingRow | '' = 'tanggal';
  sSortDir: 'asc' | 'desc' = 'desc';
  sUserDropdownOpen = false;
  sUserSearch = '';
  sPage = 1;

  // Purchasing tab
  pData: ReportData | null = null;
  pLoading = false;
  pError = '';
  pSelectedMonth = '';
  pSelectedSalesPic = '';
  pSearch = '';
  pDateField: 'tanggal' | 'need_by_date' = 'tanggal';
  pDateFrom = '';
  pDateTo = '';
  pSortCol: keyof ReportRow | '' = 'tanggal';
  pSortDir: 'asc' | 'desc' = 'desc';
  pUserDropdownOpen = false;
  pUserSearch = '';
  pPage = 1;

  // ── Users ────────────────────────────────────────────────────────
  marketingUsers: string[] = [];
  sourcingUsers: string[] = [];
  purchasingUsers: string[] = [];

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
    { value: 'follow_up',         label: 'Price Review' },
    { value: 'price_approved',    label: 'Price Approved' },
    { value: 'quotation_sent',    label: 'Quotation Sent' },
    { value: 'unsent',            label: 'Unsent' },
  ];

  readonly SOURCING_STATUS_OPTIONS = [
    { value: 'rfq',               label: 'RFQ to Sourcing' },
    { value: 'price_approval',    label: 'Price Approval' },
    { value: 'follow_up',         label: 'Price Review' },
    { value: 'price_approved',    label: 'Price Approved' },
    { value: 'quotation_sent',    label: 'Quotation Sent' },
    { value: 'missed',            label: 'Missed' },
  ];

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    void this.init();
  }

  async init(): Promise<void> {
    const users = await this.inquiryService.getUsers();
    this.marketingUsers = users.filter((u) => ['admin', 'marketing'].includes(u.role)).map((u) => u.name).sort();
    this.sourcingUsers  = users.filter((u) => ['admin', 'sourcing'].includes(u.role)).map((u) => u.name).sort();
    this.purchasingUsers = users.filter((u) => u.role === 'purchasing').map((u) => u.name).sort();
    this.activeTab = this.firstAllowedTab();
    void this.loadMarketing();
    void this.loadSourcing();
    void this.loadPurchasing();
  }

  setTab(tab: ReportTab): void {
    if (!this.canSeeTab(tab)) return;
    this.activeTab = tab;
    this.mUserDropdownOpen = false;
    this.sUserDropdownOpen = false;
    this.pUserDropdownOpen = false;
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
      rows = rows.filter((r) => [r.rfq_no, r.customer].some((v) => v && String(v).toLowerCase().includes(q)));
    }
    if (this.mDateFrom || this.mDateTo) {
      rows = rows.filter((r) => this.inDateRange(r[this.mDateField] as string | null, this.mDateFrom, this.mDateTo));
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

  // Purchasing
  async loadPurchasing(): Promise<void> {
    this.pLoading = true; this.pError = '';
    try {
      this.pData = await this.inquiryService.getReport(
        this.pSelectedMonth || undefined,
        this.pSelectedSalesPic || undefined
      );
    } catch { this.pError = 'Failed to load purchasing report.'; }
    finally { this.pLoading = false; }
  }

  onPFilterChange(): void { this.pPage = 1; void this.loadPurchasing(); }

  get pFilteredUsers(): string[] {
    const q = this.pUserSearch.toLowerCase();
    return q ? this.purchasingUsers.filter((u) => u.toLowerCase().includes(q)) : this.purchasingUsers;
  }
  get pUserLabel(): string { return this.pSelectedSalesPic || 'Semua Purchasing'; }
  openPUserDropdown(): void { this.pUserDropdownOpen = true; this.pUserSearch = ''; }
  selectPUser(name: string): void { this.pSelectedSalesPic = name; this.pUserDropdownOpen = false; this.pUserSearch = ''; this.pPage = 1; void this.loadPurchasing(); }
  clearPUser(): void { this.pSelectedSalesPic = ''; this.pUserDropdownOpen = false; this.pUserSearch = ''; this.pPage = 1; void this.loadPurchasing(); }

  setPSort(col: keyof ReportRow): void {
    if (this.pSortCol === col) { this.pSortDir = this.pSortDir === 'asc' ? 'desc' : 'asc'; }
    else { this.pSortCol = col; this.pSortDir = col === 'tanggal' ? 'desc' : 'asc'; }
    this.pPage = 1;
  }
  pSortIcon(col: keyof ReportRow): string {
    if (this.pSortCol !== col) return '↕';
    return this.pSortDir === 'asc' ? '↑' : '↓';
  }

  get pSortedRows(): ReportRow[] {
    if (!this.pData) return [];
    const col = this.pSortCol || 'tanggal';
    const dir = this.pSortDir === 'asc' ? 1 : -1;
    let rows = this.pData.rows.filter((r) => r.status === 'quotation_sent');
    if (this.pSearch.trim()) {
      const q = this.pSearch.trim().toLowerCase();
      rows = rows.filter((r) => [r.rfq_no, r.customer].some((v) => v && String(v).toLowerCase().includes(q)));
    }
    if (this.pDateFrom || this.pDateTo) {
      rows = rows.filter((r) => this.inDateRange(r[this.pDateField] as string | null, this.pDateFrom, this.pDateTo));
    }
    return [...rows].sort((a, b) => {
      const av = a[col as keyof ReportRow] ?? ''; const bv = b[col as keyof ReportRow] ?? '';
      if (av === bv) return 0; if (!av) return 1; if (!bv) return -1;
      return av < bv ? -dir : dir;
    });
  }

  get pPagedRows(): ReportRow[] {
    const start = (this.pPage - 1) * this.PAGE_SIZE;
    return this.pSortedRows.slice(start, start + this.PAGE_SIZE);
  }
  get pTotalPages(): number { return Math.ceil(this.pSortedRows.length / this.PAGE_SIZE) || 1; }

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
      rows = rows.filter((r) => [r.rfq_no, r.customer].some((v) => v && String(v).toLowerCase().includes(q)));
    }
    if (this.sDateFrom || this.sDateTo) {
      rows = rows.filter((r) => this.inDateRange(r[this.sDateField] as string | null, this.sDateFrom, this.sDateTo));
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
      rfq: 'chip-rfq', new_inquiry: 'chip-new', follow_up: 'chip-review',
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

  inDateRange(value: string | null, from: string, to: string): boolean {
    if (!value) return false;
    const v = String(value).slice(0, 10);
    if (from && v < from) return false;
    if (to && v > to) return false;
    return true;
  }

  onMDateChange(): void { this.mPage = 1; }
  onSDateChange(): void { this.sPage = 1; }
  onPDateChange(): void { this.pPage = 1; }
  clearMDateRange(): void { this.mDateFrom = ''; this.mDateTo = ''; this.mPage = 1; }
  clearSDateRange(): void { this.sDateFrom = ''; this.sDateTo = ''; this.sPage = 1; }
  clearPDateRange(): void { this.pDateFrom = ''; this.pDateTo = ''; this.pPage = 1; }

  async exportExcel(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      const month = this.activeTab === 'marketing'
        ? this.mSelectedMonth
        : this.activeTab === 'purchasing'
          ? this.pSelectedMonth
          : this.sSelectedMonth;
      const salesPic = this.activeTab === 'marketing'
        ? this.mSelectedSalesPic
        : this.activeTab === 'purchasing'
          ? this.pSelectedSalesPic
          : undefined;
      const status = this.activeTab === 'marketing'
        ? this.mSelectedStatus
        : this.activeTab === 'purchasing'
          ? 'quotation_sent'
          : this.sSelectedStatus;
      const search = this.activeTab === 'marketing'
        ? this.mSearch.trim()
        : this.activeTab === 'purchasing'
          ? this.pSearch.trim()
          : this.sSearch.trim();
      const audience = this.activeTab;
      const dateField = this.activeTab === 'marketing'
        ? this.mDateField
        : this.activeTab === 'purchasing'
          ? this.pDateField
          : this.sDateField;
      const dateFrom = this.activeTab === 'marketing'
        ? this.mDateFrom
        : this.activeTab === 'purchasing'
          ? this.pDateFrom
          : this.sDateFrom;
      const dateTo   = this.activeTab === 'marketing'
        ? this.mDateTo
        : this.activeTab === 'purchasing'
          ? this.pDateTo
          : this.sDateTo;
      const blob = await this.inquiryService.exportReport(
        month || undefined, salesPic, status || undefined, search || undefined,
        audience,
        dateField, dateFrom || undefined, dateTo || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `report-${today}${month ? '-' + month : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { this.exporting = false; }
  }

  async openDetail(id: string): Promise<void> {
    this.detailLoading = true; this.detailInquiry = null;
    this.itemNotesMap = {};
    this.expandedItemId = null;
    try { this.detailInquiry = await this.inquiryService.getById(id); }
    finally { this.detailLoading = false; }
  }

  closeDetail(): void { this.detailInquiry = null; this.itemNotesMap = {}; this.expandedItemId = null; }

  expandedItemId: string | null = null;
  itemNotesMap: Record<string, InquiryNote[]> = {};

  async toggleItemComments(item: InquiryItem): Promise<void> {
    if (!this.detailInquiry) return;
    if (this.expandedItemId === item.id) { this.expandedItemId = null; return; }
    this.expandedItemId = item.id;
    if (!this.itemNotesMap[item.id]) {
      try {
        this.itemNotesMap[item.id] = await this.inquiryService.getItemNotes(this.detailInquiry.id, item.id);
      } catch {
        this.itemNotesMap[item.id] = [];
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.user-dropdown-wrap')) {
      this.mUserDropdownOpen = false;
      this.sUserDropdownOpen = false;
      this.pUserDropdownOpen = false;
    }
  }

  isPurchasingTab(): boolean {
    return this.activeTab === 'purchasing';
  }

  canSeeTab(tab: ReportTab): boolean {
    return this.authService.hasTab('report', tab);
  }

  private firstAllowedTab(): ReportTab {
    const tabs: ReportTab[] = ['marketing', 'sourcing', 'purchasing'];
    return tabs.find((tab) => this.canSeeTab(tab)) ?? 'marketing';
  }
}


