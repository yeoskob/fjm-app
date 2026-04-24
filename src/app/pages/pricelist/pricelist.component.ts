import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { SettingsService } from '../../services/settings.service';
import { Inquiry, InquiryItem, InquiryNote, PriceApproval } from '../../models/inquiry';

@Component({
  selector: 'app-pricelist',
  templateUrl: './pricelist.component.html',
  styleUrls: ['./pricelist.component.scss'],
})
export class PricelistComponent implements OnInit {
  activeTab: 'pending' | 'review' | 'riwayat' = 'pending';
  pendingApproval: Inquiry[] = [];   // fresh from sourcing
  pendingReview: Inquiry[] = [];     // sent back by marketing
  approved: Inquiry[] = [];
  error = '';
  success = '';

  approvalForms: Record<string, Partial<PriceApproval> & { marginPct?: number }> = {};
  private defaultMarginPct = 20;
  deadlineHours = 24;

  // Modal
  selectedInquiry: Inquiry | null = null;
  itemNotesMap: Record<string, InquiryNote[]> = {};
  itemNewNote = '';
  itemSubmittingNote = false;
  currentUser = this.authService.getCurrentUser();
  editingItemId: string | null = null;
  previewImageUrl: string | null = null;
  showRejectModal = false;
  rejectReason = '';
  rejectCounterPrice: number | null = null;
  rejectTargetItem: InquiryItem | null = null;

  // Comments panel (inquiry-level)
  showComments = false;
  notes: InquiryNote[] = [];
  newNote = '';
  submittingNote = false;

  // Assignment
  assigningSalesPic = false;
  newSalesPic = '';
  assigningSourcingPic = false;
  newSourcingPic = '';
  salesUsers: Array<{ id: string; name: string; username: string; role: string }> = [];
  sourcingUsers: Array<{ id: string; name: string; username: string; role: string }> = [];

  // Paging
  pendingPage = 1;
  reviewPage = 1;
  approvedPage = 1;
  readonly pageSize = 10;

  pendingFilter = '';
  pendingSort: { col: string; dir: 'asc' | 'desc' } = { col: '', dir: 'asc' };
  reviewFilter = '';
  reviewSort: { col: string; dir: 'asc' | 'desc' } = { col: '', dir: 'asc' };
  approvedFilter = '';
  approvedSort: { col: string; dir: 'asc' | 'desc' } = { col: '', dir: 'asc' };

  toggleSort(state: { col: string; dir: 'asc' | 'desc' }, col: string): void {
    if (state.col === col) { state.dir = state.dir === 'asc' ? 'desc' : 'asc'; }
    else { state.col = col; state.dir = 'asc'; }
  }

  sortIcon(state: { col: string; dir: 'asc' | 'desc' }, col: string): string {
    return state.col !== col ? '-' : state.dir === 'asc' ? '^' : 'v';
  }

  isUrgent(inquiry: Inquiry): boolean {
    const raw = this.earliestNeedByRaw(inquiry);
    if (!raw) return false;
    const needBy = new Date(raw);
    if (isNaN(needBy.getTime())) return false;
    const msPerDay = 86400000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (needBy.getTime() - today.getTime()) <= msPerDay * 3;
  }

  private applyFS(items: Inquiry[], filter: string, sort: { col: string; dir: 'asc' | 'desc' }): Inquiry[] {
    const q = filter.trim().toLowerCase();
    let result = q
      ? items.filter((i) =>
          [i.rfqNo, i.customer, i.salesPic, i.sourcingPic ?? '', i.status]
            .some((v) => v?.toLowerCase().includes(q))
        )
      : items;
    const sortFn = (a: Inquiry, b: Inquiry): number => {
      let av: string | number = '', bv: string | number = '';
      switch (sort.col) {
        case 'rfqNo': av = a.rfqNo ?? ''; bv = b.rfqNo ?? ''; break;
        case 'customer': av = a.customer ?? ''; bv = b.customer ?? ''; break;
        case 'salesPic': av = a.salesPic ?? ''; bv = b.salesPic ?? ''; break;
        case 'sourcingPic': av = a.sourcingPic ?? ''; bv = b.sourcingPic ?? ''; break;
        case 'items': av = a.items?.length ?? 0; bv = b.items?.length ?? 0; break;
        case 'pending': av = this.pendingItemCount(a); bv = this.pendingItemCount(b); break;
        case 'status': av = a.status ?? ''; bv = b.status ?? ''; break;
        case 'tanggal': av = a.tanggal ?? ''; bv = b.tanggal ?? ''; break;
        case 'needByDate': av = this.earliestNeedByRaw(a); bv = this.earliestNeedByRaw(b); break;
      }
      const cmp = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string);
      return sort.dir === 'asc' ? cmp : -cmp;
    };
    const urgent = result.filter((i) => this.isUrgent(i)).sort(sortFn);
    const normal = result.filter((i) => !this.isUrgent(i));
    return [...urgent, ...(sort.col ? [...normal].sort(sortFn) : normal)];
  }

  get pendingFiltered(): Inquiry[] { return this.applyFS(this.pendingApproval, this.pendingFilter, this.pendingSort); }
  get reviewFiltered(): Inquiry[] { return this.applyFS(this.pendingReview, this.reviewFilter, this.reviewSort); }
  get approvedFiltered(): Inquiry[] { return this.applyFS(this.approved, this.approvedFilter, this.approvedSort); }

  get pagedPending(): Inquiry[] {
    const s = (this.pendingPage - 1) * this.pageSize;
    return this.pendingFiltered.slice(s, s + this.pageSize);
  }

  get pagedReview(): Inquiry[] {
    const s = (this.reviewPage - 1) * this.pageSize;
    return this.reviewFiltered.slice(s, s + this.pageSize);
  }

  get pagedApproved(): Inquiry[] {
    const s = (this.approvedPage - 1) * this.pageSize;
    return this.approvedFiltered.slice(s, s + this.pageSize);
  }

  pendingPages(): number { return Math.ceil(this.pendingFiltered.length / this.pageSize); }
  reviewPages(): number { return Math.ceil(this.reviewFiltered.length / this.pageSize); }
  approvedPages(): number { return Math.ceil(this.approvedFiltered.length / this.pageSize); }

  constructor(
    private inquiryService: InquiryService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    void this.settingsService.getAll().then((s) => {
      this.defaultMarginPct = s['default_margin_pct'] ? Number(s['default_margin_pct']) : 20;
      this.deadlineHours = s['price_review_deadline_hours'] ? Number(s['price_review_deadline_hours']) : 24;
    });
    void this.refresh();
    void this.inquiryService.getUsers().then((users) => {
      this.salesUsers = users.filter((u) => u.role === 'marketing');
      this.sourcingUsers = users.filter((u) => u.role === 'sourcing');
    });

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

  isReviewRequest(inquiry: Inquiry): boolean {
    return inquiry.items.some(item => item.reviewStatus === 'review' || item.needsPriceReview === true);
  }

  async refresh(): Promise<void> {
    const all = await this.inquiryService.getAll();
    const priceApproval = all.filter((i) => i.status === 'price_approval');
    this.pendingApproval = priceApproval.filter((i) => !this.isReviewRequest(i));
    this.pendingReview   = priceApproval.filter((i) =>  this.isReviewRequest(i));
    this.approved = all.filter((i) =>
      ['price_approved', 'quotation_sent'].includes(i.status)
    );
    this.pendingPage = 1;
    this.reviewPage = 1;
    this.approvedPage = 1;

    for (const inq of this.pendingApproval) {
      for (const item of inq.items ?? []) {
        if (!this.approvalForms[item.id] && !item.priceApproved) {
          const proposedPrice = this.getProposedPrice(item);
          const multiplier = 1 + this.defaultMarginPct / 100;
          this.approvalForms[item.id] = {
            hargaJual: proposedPrice ?? (item.hargaBeli ? Math.round(item.hargaBeli * multiplier) : undefined),
          };
        }
      }
    }

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
    this.editingItemId = null;
    this.showComments = false;
    this.notes = [];
    this.newNote = '';
    this.error = '';
    this.success = '';
  }

  closeModal(): void {
    this.selectedInquiry = null;
    this.itemNotesMap = {};
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.assigningSourcingPic = false;
    this.editingItemId = null;
    this.showComments = false;
    this.notes = [];
    this.newNote = '';
    this.closeRejectModal();
    this.error = '';
    this.success = '';
  }

  openRejectModal(item: InquiryItem): void {
    this.rejectTargetItem = item;
    this.rejectReason = '';
    this.rejectCounterPrice = this.getApprovedFloor(item) ?? this.getProposedPrice(item) ?? null;
    this.showRejectModal = true;
    this.error = '';
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectReason = '';
    this.rejectCounterPrice = null;
    this.rejectTargetItem = null;
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

  async toggleComments(): Promise<void> {
    this.showComments = !this.showComments;
    if (this.showComments && this.selectedInquiry && this.notes.length === 0) {
      this.notes = await this.inquiryService.getItemNotes(this.selectedInquiry.id, 'general');
    }
  }

  async submitNote(): Promise<void> {
    if (!this.newNote.trim() || !this.selectedInquiry) return;
    const user = this.currentUser;
    if (!user) return;
    this.submittingNote = true;
    try {
      await this.inquiryService.addItemNote(this.selectedInquiry.id, 'general', this.newNote, user.username, user.name, user.role);
      this.newNote = '';
      this.notes = await this.inquiryService.getItemNotes(this.selectedInquiry.id, 'general');
    } finally {
      this.submittingNote = false;
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

  toggleApprove(item: InquiryItem): void {
    if (!this.selectedInquiry || this.selectedInquiry.status !== 'price_approval') return;
    if (this.editingItemId === item.id) {
      this.cancelApprove();
      return;
    }
    this.startApprove(item);
    if (!this.itemNotesMap[item.id]) {
      void this.loadItemNotes(this.selectedInquiry.id, item.id);
    }
  }

  startApprove(item: InquiryItem): void {
    this.editingItemId = item.id;
    this.itemNewNote = '';
    this.error = '';
    const proposedPrice = this.getProposedPrice(item);
    const multiplier = 1 + this.defaultMarginPct / 100;
    this.approvalForms[item.id] = {
      hargaJual: this.approvalForms[item.id]?.hargaJual
        ?? proposedPrice
        ?? (item.hargaBeli ? Math.round(item.hargaBeli * multiplier) : undefined),
      leadTimeCustomer: this.approvalForms[item.id]?.leadTimeCustomer ?? item.leadTimeCustomer,
      validitasQuotation: this.approvalForms[item.id]?.validitasQuotation ?? item.validitasQuotation,
      catatanQuotation: this.approvalForms[item.id]?.catatanQuotation ?? item.catatanQuotation,
    };
    this.updateMarginPctFromHargaJual(item);
  }

  cancelApprove(): void {
    this.editingItemId = null;
    this.error = '';
  }

  async approve(inq: Inquiry, item: InquiryItem): Promise<void> {
    const form = this.approvalForms[item.id];
    if (!form?.hargaJual || form.hargaJual <= 0) {
      this.error = 'Harga jual wajib diisi.';
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const payload: PriceApproval = {
      hargaJual: form.hargaJual,
      leadTimeCustomer: form.leadTimeCustomer,
      validitasQuotation: form.validitasQuotation,
      catatanQuotation: form.catatanQuotation,
      doneBy: user.username,
      doneByName: user.name,
    };

    await this.inquiryService.approveItem(inq.id, item.id, payload);
    delete this.approvalForms[item.id];
    this.editingItemId = null;
    this.success = `Item "${item.itemName}" approved.`;
    await this.refresh();
  }

  async reject(inq: Inquiry, item: InquiryItem, counterPrice: number | null, reason?: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    if (!counterPrice || counterPrice <= 0) {
      this.error = 'Counter price is required.';
      return;
    }
    this.error = '';
    this.success = '';
    try {
      await this.inquiryService.rejectItem(inq.id, item.id, user.username, user.name, counterPrice, String(reason ?? '').trim() || undefined);
      this.editingItemId = null;
      this.closeRejectModal();
      this.success = `Counter price updated for "${item.itemName}".`;
      await this.refresh();
    } catch (e: any) {
      this.error = e?.error?.error ?? 'Failed to update counter price.';
    }
  }

  hasUnsourcedItems(inq: Inquiry): boolean {
    return (inq.items ?? []).some((i) => !i.priceApproved && !i.hargaBeli);
  }

  async returnToSourcing(): Promise<void> {
    if (!this.selectedInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    this.success = '';
    try {
      await this.inquiryService.returnToSourcing(this.selectedInquiry.id, user.username, user.name);
      this.success = 'Inquiry dikembalikan ke Sourcing.';
      await this.refresh();
      this.closeModal();
    } catch (e: any) {
      this.error = e?.error?.error ?? 'Gagal mengembalikan ke sourcing.';
    }
  }

  async sendToPriceApproved(): Promise<void> {
    if (!this.selectedInquiry || this.selectedInquiry.status !== 'price_approval') return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    this.success = '';
    try {
      await this.inquiryService.sendToPriceApproved(this.selectedInquiry.id, user.username, user.name);
      this.success = 'Inquiry sent to Price Approved.';
      await this.refresh();
      this.closeModal();
    } catch (e: any) {
      this.error = e?.error?.error ?? 'Failed to send to Price Approved.';
    }
  }

  updateMarginPctFromHargaJual(item: InquiryItem): void {
    const form = this.approvalForms[item.id];
    if (!form || !item.hargaBeli || !form.hargaJual) { if (form) form.marginPct = undefined; return; }
    const pct = ((form.hargaJual - item.hargaBeli) / item.hargaBeli) * 100;
    form.marginPct = Math.round(pct * 10) / 10;
  }

  updateHargaJualFromMargin(item: InquiryItem, value: number): void {
    const form = this.approvalForms[item.id];
    if (!form || !item.hargaBeli) return;
    const pct = Number(value);
    if (!Number.isFinite(pct)) return;
    form.hargaJual = Math.round(item.hargaBeli * (1 + pct / 100));
  }

  private earliestNeedByRaw(inquiry: Inquiry): string {
    if (inquiry.needByDate) return inquiry.needByDate;
    const dates = (inquiry.items ?? []).map((i) => i.itemNeedByDate).filter((d): d is string => !!d);
    return dates.length ? dates.sort()[0] : '';
  }

  earliestNeedByDate(inquiry: Inquiry): string {
    const raw = this.earliestNeedByRaw(inquiry);
    return raw ? this.formatDateOnly(raw) : '-';
  }

  isApproved(item: InquiryItem): boolean {
    return item.priceApproved === true;
  }

  pendingItemCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => !i.priceApproved).length ?? 0;
  }

  approvedItemCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => i.priceApproved).length ?? 0;
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

  getMargin(item: InquiryItem, id: string): number {
    const hargaJual = this.approvalForms[id]?.hargaJual ?? this.getProposedPrice(item) ?? 0;
    return hargaJual - (item.hargaBeli ?? 0);
  }

  isNeedsReview(item: InquiryItem): boolean {
    return item.reviewStatus === 'review' || item.needsPriceReview === true;
  }

  isRejected(item: InquiryItem): boolean {
    return item.reviewStatus === 'rejected';
  }

  getProposedPrice(item: InquiryItem): number | undefined {
    return item.hargaJual ?? item.approvedPrice;
  }

  getApprovedFloor(item: InquiryItem): number | undefined {
    return item.approvedPrice;
  }

  getApprovedPrice(item: InquiryItem): number | undefined {
    return this.getProposedPrice(item);
  }

  getMarginPct(item: InquiryItem, id: string): number {
    if (!item.hargaBeli) return 0;
    return (this.getMargin(item, id) / item.hargaBeli) * 100;
  }

  formatCurrency(value?: number): string {
    if (value == null) return '-';
    return 'Rp ' + value.toLocaleString('id-ID');
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

  openImagePreview(url: string, event: Event): void {
    event.stopPropagation();
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  timeLeft(inquiry: Inquiry): { text: string; state: 'ok' | 'warning' | 'overdue' } | null {
    if (!inquiry.priceApprovalStartedAt) return null;
    const started = new Date(inquiry.priceApprovalStartedAt).getTime();
    if (isNaN(started)) return null;
    const deadlineMs = started + this.deadlineHours * 3600 * 1000;
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) {
      const overH = Math.floor(Math.abs(remaining) / 3600000);
      return { text: overH > 0 ? `Overdue ${overH}j` : 'Overdue', state: 'overdue' };
    }
    const totalMs = this.deadlineHours * 3600 * 1000;
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const text = h > 0 ? `${h}j ${m}mnt` : `${m}mnt`;
    const state = remaining / totalMs <= 0.25 ? 'warning' : 'ok';
    return { text, state };
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      price_approval: 'Price Approval',
      price_approved: 'Price Approved',
      quotation_sent: 'Quotation Sent',
    };
    return map[status] ?? status;
  }

  ppnTypeLabel(type?: string | null): string {
    if (!type) return '';
    const map: Record<string, string> = { incl_ppn: 'Incl. PPN', excl_ppn: 'Excl. PPN', non_ppn: 'Non PPN' };
    return map[type] ?? type;
  }
}


