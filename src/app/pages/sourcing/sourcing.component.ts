import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
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
  openCommentItemId: string | null = null;
  itemNewNote = '';
  itemSubmittingNote = false;
  currentUser = this.authService.getCurrentUser();

  assigningSalesPic = false;
  newSalesPic = '';
  assigningSourcingPic = false;
  newSourcingPic = '';
  salesUsers: Array<{ id: string; name: string; username: string; role: string }> = [];
  sourcingUsers: Array<{ id: string; name: string; username: string; role: string }> = [];

  rfqPage = 1;
  donePage = 1;
  readonly pageSize = 10;

  get pagedRfq(): Inquiry[] {
    const s = (this.rfqPage - 1) * this.pageSize;
    return this.rfqInquiries.slice(s, s + this.pageSize);
  }

  get pagedDone(): Inquiry[] {
    const s = (this.donePage - 1) * this.pageSize;
    return this.doneInquiries.slice(s, s + this.pageSize);
  }

  rfqPages(): number { return Math.ceil(this.rfqInquiries.length / this.pageSize); }
  donePages(): number { return Math.ceil(this.doneInquiries.length / this.pageSize); }

  fillingInquiryId: string | null = null;
  fillingItem: InquiryItem | null = null;
  editingItemId: string | null = null;
  fillForm: Partial<SourcingInfo> = {};
  previewImageUrl: string | null = null;

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    void this.refresh();
    if (this.isAdminOrManager()) {
      void this.inquiryService.getUsers().then((users) => {
        this.salesUsers = users.filter((u) => u.role === 'marketing');
        this.sourcingUsers = users.filter((u) => u.role === 'sourcing');
      });
    }
  }

  isAdminOrManager(): boolean {
    const role = this.currentUser?.role;
    return role === 'admin' || role === 'manager';
  }

  async refresh(): Promise<void> {
    const all = await this.inquiryService.getAll();
    const user = this.currentUser;
    const isSourcingOnly = user?.role === 'sourcing';

    const visible = isSourcingOnly
      ? all.filter((i) => !i.sourcingPic || i.sourcingPic === user!.name)
      : all;

    this.rfqInquiries = visible.filter((i) => i.status === 'rfq');
    this.rfqPage = 1;
    this.donePage = 1;
    this.doneInquiries = visible.filter((i) =>
      ['price_approval', 'quotation_sent', 'deal', 'lost'].includes(i.status)
    );
    // Keep modal in sync after refresh
    if (this.selectedInquiry) {
      const updated = all.find((i) => i.id === this.selectedInquiry!.id);
      this.selectedInquiry = updated ?? null;
    }
  }

  openModal(inquiry: Inquiry): void {
    this.selectedInquiry = inquiry;
    this.itemNotesMap = {};
    this.openCommentItemId = null;
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.assigningSourcingPic = false;
    this.cancelFill();
  }

  closeModal(): void {
    this.selectedInquiry = null;
    this.itemNotesMap = {};
    this.openCommentItemId = null;
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.assigningSourcingPic = false;
    this.cancelFill();
    this.error = '';
    this.success = '';
  }

  canComment(): boolean {
    const user = this.currentUser;
    if (!user || !this.selectedInquiry) return false;
    const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
    const isAssigned = user.name === this.selectedInquiry.salesPic || user.name === this.selectedInquiry.sourcingPic;
    return isAdminOrManager || isAssigned;
  }

  async toggleItemComments(item: InquiryItem): Promise<void> {
    if (this.openCommentItemId === item.id) {
      this.openCommentItemId = null;
    } else {
      this.openCommentItemId = item.id;
      this.itemNewNote = '';
      if (!this.itemNotesMap[item.id]) {
        await this.loadItemNotes(this.selectedInquiry!.id, item.id);
      }
    }
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
    this.fillForm = {
      supplier: item.supplier,
      hargaBeli: item.hargaBeli,
      leadTime: item.leadTime,
      moq: item.moq,
      stockAvailability: item.stockAvailability,
      termPembayaran: item.termPembayaran,
    };
  }

  cancelFill(): void {
    this.fillingInquiryId = null;
    this.fillingItem = null;
    this.editingItemId = null;
    this.fillForm = {};
    this.error = '';
  }

  async submitSourcingInfo(): Promise<void> {
    if (!this.fillingInquiryId || !this.fillingItem) return;
    this.error = '';

    const { supplier, hargaBeli, leadTime } = this.fillForm;
    if (!supplier?.trim() || hargaBeli == null || !leadTime?.trim()) {
      this.error = 'Supplier, harga beli, dan lead time wajib diisi.';
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }

    const payload: SourcingInfo = {
      supplier: supplier.trim(),
      hargaBeli,
      leadTime: leadTime.trim(),
      moq: this.fillForm.moq,
      stockAvailability: this.fillForm.stockAvailability?.trim(),
      termPembayaran: this.fillForm.termPembayaran?.trim(),
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

  async sendToPriceApproval(): Promise<void> {
    if (!this.selectedInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }
    this.error = '';
    await this.inquiryService.sendToPriceApproval(this.selectedInquiry.id, user.username, user.name);
    this.success = 'Sent to Price Approval.';
    await this.refresh();
  }

  isSourced(item: InquiryItem): boolean {
    return !!(item.supplier && item.hargaBeli != null && item.leadTime);
  }

  itemCount(inquiry: Inquiry): number {
    return inquiry.items?.length ?? 0;
  }

  pendingCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => !this.isSourced(i)).length ?? 0;
  }

  sourcedCount(inquiry: Inquiry): number {
    return inquiry.items?.filter((i) => this.isSourced(i)).length ?? 0;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      rfq: 'RFQ', price_approval: 'Price Approval', quotation_sent: 'Quotation Sent',
      deal: 'Deal', lost: 'Lost',
    };
    return map[status] ?? status;
  }

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!iso.includes('T')) return datePart;
    const h = d.getUTCHours(), m = d.getUTCMinutes();
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${datePart}, ${time}`;
  }

  formatCurrency(value?: number): string {
    if (value == null) return '-';
    return 'Rp ' + value.toLocaleString('id-ID');
  }
}