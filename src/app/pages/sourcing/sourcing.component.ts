import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { ToastService } from '../../services/toast.service';
import { Inquiry, InquiryItem, InquiryNote, SourcingInfo } from '../../models/inquiry';

@Component({
  selector: 'app-sourcing',
  templateUrl: './sourcing.component.html',
  styleUrls: ['./sourcing.component.scss'],
})
export class SourcingComponent implements OnInit {
  rfqInquiries: Inquiry[] = [];
  doneInquiries: Inquiry[] = [];
  error = '';
  success = '';

  selectedInquiry: Inquiry | null = null;
  itemNotesMap: Record<string, InquiryNote[]> = {};
  itemNewNote = '';
  itemSubmittingNote = false;
  currentUser = this.authService.getCurrentUser();

  assigningSalesPic = false;
  newSalesPic = '';
  assigningSourcingPic = false;
  newSourcingPic = '';
  salesUsers: Array<{ id: string; name: string; username: string; role: string }> = [];
  sourcingUsers: Array<{ id: string; name: string; username: string; role: string }> = [];

  activeTab: 'rfq' | 'riwayat' = 'rfq';
  rfqPage = 1;
  donePage = 1;
  readonly pageSize = 10;

  rfqFilter = '';
  rfqSort: { col: string; dir: 'asc' | 'desc' } = { col: '', dir: 'asc' };
  doneFilter = '';
  doneSort: { col: string; dir: 'asc' | 'desc' } = { col: '', dir: 'asc' };

  toggleSort(state: { col: string; dir: 'asc' | 'desc' }, col: string): void {
    if (state.col === col) { state.dir = state.dir === 'asc' ? 'desc' : 'asc'; }
    else { state.col = col; state.dir = 'asc'; }
  }

  sortIcon(state: { col: string; dir: 'asc' | 'desc' }, col: string): string {
    return state.col !== col ? '↕' : state.dir === 'asc' ? '↑' : '↓';
  }

  private applyFS(items: Inquiry[], filter: string, sort: { col: string; dir: 'asc' | 'desc' }): Inquiry[] {
    const q = filter.trim().toLowerCase();
    let result = q
      ? items.filter((i) =>
          [i.rfqNo, i.customer, i.salesPic, i.sourcingPic ?? '', i.status]
            .some((v) => v?.toLowerCase().includes(q))
        )
      : items;
    if (!sort.col) return result;
    const sortFn = (a: Inquiry, b: Inquiry): number => {
      let av: string | number = '', bv: string | number = '';
      switch (sort.col) {
        case 'rfqNo': av = a.rfqNo ?? ''; bv = b.rfqNo ?? ''; break;
        case 'customer': av = a.customer ?? ''; bv = b.customer ?? ''; break;
        case 'salesPic': av = a.salesPic ?? ''; bv = b.salesPic ?? ''; break;
        case 'sourcingPic': av = a.sourcingPic ?? ''; bv = b.sourcingPic ?? ''; break;
        case 'items': av = this.itemCount(a); bv = this.itemCount(b); break;
        case 'pending': av = this.pendingCount(a); bv = this.pendingCount(b); break;
        case 'sourced': av = this.sourcedCount(a); bv = this.sourcedCount(b); break;
        case 'status': av = a.status ?? ''; bv = b.status ?? ''; break;
        case 'tanggal': av = a.tanggal ?? ''; bv = b.tanggal ?? ''; break;
        case 'daysLeft': {
          const da = this.daysLeft(this.earliestNeedByDate(a));
          const db2 = this.daysLeft(this.earliestNeedByDate(b));
          av = da ?? 999999; bv = db2 ?? 999999; break;
        }
      }
      const cmp = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string);
      return sort.dir === 'asc' ? cmp : -cmp;
    };
    return [...result].sort(sortFn);
  }

  get rfqFiltered(): Inquiry[] { return this.applyFS(this.rfqInquiries, this.rfqFilter, this.rfqSort); }
  get doneFiltered(): Inquiry[] { return this.applyFS(this.doneInquiries, this.doneFilter, this.doneSort); }

  get pagedRfq(): Inquiry[] {
    const s = (this.rfqPage - 1) * this.pageSize;
    return this.rfqFiltered.slice(s, s + this.pageSize);
  }

  get pagedDone(): Inquiry[] {
    const s = (this.donePage - 1) * this.pageSize;
    return this.doneFiltered.slice(s, s + this.pageSize);
  }

  rfqPages(): number { return Math.ceil(this.rfqFiltered.length / this.pageSize); }
  donePages(): number { return Math.ceil(this.doneFiltered.length / this.pageSize); }

  fillingInquiryId: string | null = null;
  fillingItem: InquiryItem | null = null;
  editingItemId: string | null = null;
  viewingItemId: string | null = null;
  fillForm: Partial<SourcingInfo> & { leadTimeNum?: number } = {};
  ppnType: 'incl_ppn' | 'excl_ppn' | 'non_ppn' | null = null;
  previewImageUrl: string | null = null;

  constructor(private inquiryService: InquiryService, private authService: AuthService, private toast: ToastService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const tabs: Array<'rfq' | 'riwayat'> = ['rfq', 'riwayat'];
    const qTab = this.route.snapshot.queryParamMap.get('tab') as typeof tabs[number] | null;
    if (qTab && tabs.includes(qTab)) this.activeTab = qTab;
    void this.refresh();
    if (this.isAdminOrManager()) {
      void this.inquiryService.getUsers().then((users) => {
        this.salesUsers = users.filter((u) => u.role === 'marketing');
        this.sourcingUsers = users.filter((u) => u.role === 'sourcing');
      });
    }

    const initialRefresh = this.route.snapshot.queryParamMap.get('refresh');
    this.route.queryParams.subscribe((params) => {
      const r = params['refresh'];
      if (r && r !== initialRefresh) void this.refresh();
    });
  }

  isAdminOrManager(): boolean {
    const role = this.currentUser?.role;
    return role === 'admin' || role === 'manager';
  }

  async refresh(): Promise<void> {
    const all = await this.inquiryService.getAll();
    const user = this.currentUser;

    const doneStatuses = ['price_approval', 'price_approved', 'quotation_sent', 'follow_up', 'ready_to_purchase', 'missed', 'unsent'];

    if (this.isAdminOrManager()) {
      // Admin/manager see everything
      this.rfqInquiries = all.filter((i) => i.status === 'rfq');
      this.doneInquiries = all.filter((i) => doneStatuses.includes(i.status));
    } else {
      // RFQ tab: own + unassigned (so users can pick up new work)
      this.rfqInquiries = all.filter(
        (i) => i.status === 'rfq' && (!i.sourcingPic || i.sourcingPic === user!.name)
      );
      // Riwayat tab: strictly only assigned to this user (no unassigned)
      this.doneInquiries = all.filter(
        (i) => doneStatuses.includes(i.status) && i.sourcingPic === user!.name
      );
    }

    this.rfqPage = 1;
    this.donePage = 1;
    // Keep modal in sync after refresh
    if (this.selectedInquiry) {
      const updated = all.find((i) => i.id === this.selectedInquiry!.id);
      this.selectedInquiry = updated ?? null;
    }
  }

  openModal(inquiry: Inquiry): void {
    this.selectedInquiry = inquiry;
    this.itemNotesMap = {};
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.assigningSourcingPic = false;
    this.viewingItemId = null;
    this.cancelFill();
  }

  closeModal(): void {
    this.selectedInquiry = null;
    this.itemNotesMap = {};
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.assigningSourcingPic = false;
    this.viewingItemId = null;
    this.cancelFill();
    this.error = '';
    this.success = '';
  }

  organizationClass(org?: string): string {
    if (org === 'FMI') return 'org-badge-fmi';
    if (org === 'FSA') return 'org-badge-fsa';
    return 'org-badge-fjm';
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      new_inquiry: 'badge-blue',
      rfq: 'badge-yellow',
      price_approval: 'badge-orange',
      price_approved: 'badge-teal',
      quotation_sent: 'badge-purple',
      follow_up: 'badge-purple',
      ready_to_purchase: 'badge-indigo',
      missed: 'badge-red',
      unsent: 'badge-red',
    };
    return map[status] ?? 'badge-gray';
  }

  async toggleView(item: InquiryItem): Promise<void> {
    if (this.viewingItemId === item.id) {
      this.viewingItemId = null;
      return;
    }
    this.viewingItemId = item.id;
    if (!this.itemNotesMap[item.id] && this.selectedInquiry) {
      await this.loadItemNotes(this.selectedInquiry.id, item.id);
    }
  }

  canComment(): boolean {
    const user = this.currentUser;
    if (!user || !this.selectedInquiry) return false;
    const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
    const isAssigned = user.name === this.selectedInquiry.salesPic || user.name === this.selectedInquiry.sourcingPic;
    return isAdminOrManager || isAssigned;
  }

  async loadItemNotes(inquiryId: string, itemId: string): Promise<void> {
    this.itemNotesMap[itemId] = await this.inquiryService.getItemNotes(inquiryId, itemId);
  }

  async submitItemNote(item: InquiryItem): Promise<void> {
    if (!this.itemNewNote.trim() || !this.selectedInquiry) return;
    const user = this.currentUser;
    if (!user) return;
    this.itemSubmittingNote = true;
    try {
      await this.inquiryService.addItemNote(this.selectedInquiry.id, item.id, this.itemNewNote, user.username, user.name, user.role);
      this.itemNewNote = '';
      await this.loadItemNotes(this.selectedInquiry.id, item.id);
    } finally {
      this.itemSubmittingNote = false;
    }
  }

  formatDateOnly(iso?: string): string {
    if (!iso) return '-';
    return this.formatDate(iso.slice(0, 10));
  }

  startFill(inquiry: Inquiry, item: InquiryItem): void {
    this.fillingInquiryId = inquiry.id;
    this.fillingItem = item;
    this.editingItemId = item.id;
    this.error = '';
    const storedLeadTime = item.leadTime ?? item.bidLeadTime ?? '';
    const leadTimeNum = storedLeadTime ? parseInt(String(storedLeadTime), 10) || undefined : undefined;
    this.fillForm = {
      supplier: item.supplier,
      hargaBeli: item.hargaBeli ?? item.bidPriceAmount ?? undefined,
      leadTime: item.leadTime ?? (storedLeadTime ? String(storedLeadTime) : undefined),
      leadTimeNum,
      moq: item.moq,
      stockAvailability: item.stockAvailability,
      termPembayaran: item.termPembayaran,
      alternateName: item.alternateName,
    };
    this.ppnType = (item.ppnType as typeof this.ppnType) ?? null;
  }

  async toggleFill(item: InquiryItem): Promise<void> {
    if (!this.selectedInquiry || this.selectedInquiry.status !== 'rfq') return;
    if (this.editingItemId === item.id) {
      this.cancelFill();
      this.itemNewNote = '';
      return;
    }

    this.startFill(this.selectedInquiry, item);
    this.itemNewNote = '';
    if (!this.itemNotesMap[item.id]) {
      await this.loadItemNotes(this.selectedInquiry.id, item.id);
    }
  }

  cancelFill(): void {
    this.fillingInquiryId = null;
    this.fillingItem = null;
    this.editingItemId = null;
    this.fillForm = {};
    this.ppnType = null;
    this.error = '';
  }

  async submitSourcingInfo(): Promise<void> {
    if (!this.fillingInquiryId || !this.fillingItem) return;
    this.error = '';

    const { supplier, hargaBeli, leadTimeNum } = this.fillForm;
    if (!supplier?.trim() || hargaBeli == null || leadTimeNum == null) {
      this.error = 'Supplier, harga beli, dan lead time wajib diisi.';
      return;
    }
    const leadTime = `${leadTimeNum} hari`;

    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }

    const payload: SourcingInfo = {
      supplier: supplier.trim(),
      hargaBeli,
      leadTime: leadTime.trim(),
      moq: this.fillForm.moq,
      stockAvailability: this.fillForm.stockAvailability?.trim(),
      termPembayaran: this.fillForm.termPembayaran?.trim(),
      alternateName: this.fillForm.alternateName?.trim(),
      ppnType: this.ppnType ?? undefined,
      doneBy: user.username,
      doneByName: user.name,
    };

    await this.inquiryService.submitSourcingInfoItem(this.fillingInquiryId, this.fillingItem.id, payload);
    if (this.selectedInquiry && !this.selectedInquiry.sourcingPic) {
      await this.inquiryService.assignSourcing(this.fillingInquiryId, user.name, user.username, user.name, user.role);
    }
    this.success = `Info sourcing untuk "${this.fillingItem.itemName}" berhasil disimpan.`;
    this.cancelFill();
    await this.refresh();
  }


  openImagePreview(url: string, event: Event): void {
    event.stopPropagation();
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  async saveSalesPic(): Promise<void> {
    if (!this.newSalesPic || !this.selectedInquiry) return;
    const user = this.currentUser;
    if (!user) return;
    await this.inquiryService.assignSales(this.selectedInquiry.id, this.newSalesPic, user.username, user.name, user.role);
    this.assigningSalesPic = false;
    await this.refresh();
  }

  async saveSourcingPic(): Promise<void> {
    if (!this.selectedInquiry) return;
    const user = this.currentUser;
    if (!user) return;
    await this.inquiryService.assignSourcing(this.selectedInquiry.id, this.newSourcingPic || null, user.username, user.name, user.role);
    this.assigningSourcingPic = false;
    await this.refresh();
  }

  async assignToMe(): Promise<void> {
    if (!this.selectedInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    try {
      await this.inquiryService.assignSourcing(this.selectedInquiry.id, user.name, user.username, user.name, user.role);
      this.success = 'Assigned to you.';
      await this.refresh();
    } catch {
      this.error = 'Already assigned to another sourcing user.';
    }
  }

  sendingToPriceApproval = false;

  async sendToPriceApproval(): Promise<void> {
    if (this.sendingToPriceApproval) return;
    if (!this.selectedInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) { this.toast.error('Not logged in.'); return; }
    this.error = '';
    this.sendingToPriceApproval = true;
    try {
      await this.inquiryService.sendToPriceApproval(this.selectedInquiry.id, user.username, user.name);
      this.toast.success('Sent to Price Approval.');
      await this.refresh();
    } catch (e: any) {
      this.toast.error(e?.error?.error ?? 'Failed to send to Price Approval.');
    } finally {
      this.sendingToPriceApproval = false;
    }
  }

  isSourced(item: InquiryItem): boolean {
    return !!(item.supplier && item.hargaBeli != null && item.leadTime);
  }

  isMissed(_item?: InquiryItem): boolean {
    return !!this.selectedInquiry?.sourcingMissed;
  }

  isInqMissed(inq: Inquiry): boolean {
    return !!inq.sourcingMissed;
  }

  itemCount(inquiry: Inquiry): number {
    return inquiry.items?.length ?? 0;
  }

  pendingCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => !this.isSourced(i)).length ?? 0;
  }

  sourcedCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => this.isSourced(i) && !this.isMissed(i)).length ?? 0;
  }

  missedCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => this.isMissed(i)).length ?? 0;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      rfq: 'RFQ', price_approval: 'Price Approval', price_approved: 'Price Approved',
      quotation_sent: 'Quotation Sent', follow_up: 'Negotiation', ready_to_purchase: 'Ready to Purchase',
      missed: 'Missed', unsent: 'Unsent',
    };
    return map[status] ?? status;
  }

  earliestNeedByDate(inq: Inquiry): string | null {
    const dates = (inq.items ?? [])
      .map((i) => i.itemNeedByDate)
      .filter((d): d is string => !!d)
      .sort();
    return dates[0] ?? null;
  }

  daysLeft(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  daysLeftLabel(dateStr: string | null): string {
    const d = this.daysLeft(dateStr);
    if (d === null) return '-';
    if (d < 0) return `${Math.abs(d)}d overdue`;
    return `${d}d`;
  }

  daysLeftClass(dateStr: string | null): string {
    const d = this.daysLeft(dateStr);
    if (d === null) return '';
    if (d < 0) return 'days-overdue';
    if (d <= 3) return 'days-warning';
    return 'days-ok';
  }

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!iso.includes('T')) return datePart;
    const h = d.getHours(), m = d.getMinutes();
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${datePart}, ${time}`;
  }

  formatCurrency(value?: number): string {
    if (value == null) return '-';
    return 'Rp ' + value.toLocaleString('id-ID');
  }

  ppnTypeLabel(type?: string | null): string {
    if (!type) return '';
    const map: Record<string, string> = { incl_ppn: 'Incl. PPN', excl_ppn: 'Excl. PPN', non_ppn: 'Non PPN' };
    return map[type] ?? type;
  }
}
