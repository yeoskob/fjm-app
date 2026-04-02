import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { Inquiry, InquiryCreate, InquiryItem, InquiryNote, InquiryStatus, INQUIRY_STATUS_LABELS } from '../../models/inquiry';

@Component({
  selector: 'app-marketing',
  templateUrl: './marketing.component.html',
  styleUrls: ['./marketing.component.scss'],
})
export class MarketingComponent implements OnInit {
  inquiries: Inquiry[] = [];
  error = '';
  success = '';
  isAdmin = false;

  showCreate = false;
  form: Partial<InquiryCreate> = {};
  showImport = false;
  importFile: File | null = null;
  importing = false;

  detailInquiry: Inquiry | null = null;
  showLog = false;
  itemNotesMap: Record<string, InquiryNote[]> = {};
  openCommentItemId: string | null = null;
  itemNewNote = '';
  itemSubmittingNote = false;
  salesUsers: Array<{ id: string; name: string; username: string; role: string }> = [];
  assigningSalesPic = false;
  newSalesPic = '';
  editInquiry: Inquiry | null = null;
  editForm: Partial<InquiryCreate> = {};
  closeNote = '';
  rfqNote = '';

  reviewingItemId: string | null = null;
  reviewItemForm: { targetPrice?: number; itemImage?: string } = {};
  editingHargaJualId: string | null = null;
  hargaJualInput: number | null = null;
  viewingItemId: string | null = null;
  showAddItem = false;
  addItemForm: { itemName?: string; itemQuantity?: number; itemUom?: string; itemNeedByDate?: string; itemManufacturerName?: string; itemManufacturerPartNumber?: string; itemClassificationOfGoods?: string; itemExtendedDescription?: string; targetPrice?: number; itemImage?: string } = {};
  previewImageUrl: string | null = null;

  activeTab: 'rfq' | 'quotation' | 'deals' = 'rfq';

  readonly STATUS_LABELS = INQUIRY_STATUS_LABELS;
  readonly PIPELINE_STAGES: InquiryStatus[] = [
    'new_inquiry', 'rfq', 'price_approval', 'quotation_sent', 'deal', 'lost'
  ];

  rfqFilter = ''; rfqSort = { col: '', dir: 'asc' as 'asc'|'desc' };
  quotationFilter = ''; quotationSort = { col: '', dir: 'asc' as 'asc'|'desc' };
  dealsFilter = ''; dealsSort = { col: '', dir: 'asc' as 'asc'|'desc' };

  toggleSort(state: { col: string; dir: 'asc'|'desc' }, col: string): void {
    if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.col = col; state.dir = 'asc'; }
  }

  sortIcon(state: { col: string; dir: 'asc'|'desc' }, col: string): string {
    return state.col !== col ? '↕' : state.dir === 'asc' ? '↑' : '↓';
  }

  private applyFS(items: Inquiry[], filter: string, sort: { col: string; dir: 'asc'|'desc' }): Inquiry[] {
    let r = items;
    if (filter.trim()) {
      const f = filter.toLowerCase();
      r = r.filter(i =>
        (i.rfqNo ?? '').toLowerCase().includes(f) ||
        i.customer.toLowerCase().includes(f) ||
        i.salesPic.toLowerCase().includes(f) ||
        (i.sourcingPic ?? '').toLowerCase().includes(f) ||
        i.status.toLowerCase().includes(f)
      );
    }
    if (sort.col) {
      r = [...r].sort((a, b) => {
        let av: string|number = '', bv: string|number = '';
        if (sort.col === 'rfqNo') { av = a.rfqNo ?? ''; bv = b.rfqNo ?? ''; }
        else if (sort.col === 'customer') { av = a.customer; bv = b.customer; }
        else if (sort.col === 'salesPic') { av = a.salesPic; bv = b.salesPic; }
        else if (sort.col === 'sourcingPic') { av = a.sourcingPic ?? ''; bv = b.sourcingPic ?? ''; }
        else if (sort.col === 'status') { av = a.status; bv = b.status; }
        else if (sort.col === 'tanggal') { av = a.tanggal; bv = b.tanggal; }
        else if (sort.col === 'updatedAt') { av = a.updatedAt ?? ''; bv = b.updatedAt ?? ''; }
        else if (sort.col === 'items') { av = a.items.length; bv = b.items.length; }
        else if (sort.col === 'needByDate') { av = a.items[0]?.itemNeedByDate ?? ''; bv = b.items[0]?.itemNeedByDate ?? ''; }
        return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
      });
    }
    return r;
  }

  get rfqTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'new_inquiry');
  }

  get quotationTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'quotation_sent');
  }

  get dealsTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'deal');
  }

  get rfqTabFiltered(): Inquiry[] { return this.applyFS(this.rfqTabInquiries, this.rfqFilter, this.rfqSort); }
  get quotationTabFiltered(): Inquiry[] { return this.applyFS(this.quotationTabInquiries, this.quotationFilter, this.quotationSort); }
  get dealsTabFiltered(): Inquiry[] { return this.applyFS(this.dealsTabInquiries, this.dealsFilter, this.dealsSort); }

  earliestNeedByDate(inq: Inquiry): string {
    const dates = inq.items
      .map((it) => it.itemNeedByDate)
      .filter((d): d is string => !!d)
      .sort();
    return dates.length ? this.formatDate(dates[0]) : '-';
  }

  /** Columns where marketing/sales can take action */
  isActionable(stage: InquiryStatus): boolean {
    return ['new_inquiry', 'quotation_sent'].includes(stage);
  }

  /** Columns where marketing is waiting on another team */
  isWaiting(stage: InquiryStatus): boolean {
    return ['rfq', 'price_approval'].includes(stage);
  }

  /** Closed outcome columns */
  isClosed(stage: InquiryStatus): boolean {
    return ['deal', 'lost'].includes(stage);
  }

  constructor(private inquiryService: InquiryService, public authService: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('admin');
    void this.refresh();
    const user = this.authService.getCurrentUser();
    if (user?.role === 'admin' || user?.role === 'manager') {
      void this.inquiryService.getUsers().then((users) => {
        this.salesUsers = users.filter((u) => u.role === 'marketing');
      });
    }
  }

  async refresh(): Promise<void> {
    const all = await this.inquiryService.getAll();
    const user = this.authService.getCurrentUser();
    const isPrivileged = user?.role === 'admin' || user?.role === 'manager';
    if (isPrivileged) {
      this.inquiries = all;
    } else {
      this.inquiries = all.filter((i) => i.createdBy === user?.username || i.salesPic === user?.name);
    }
  }

  get activeInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => !['deal', 'lost'].includes(i.status));
  }

  get closedInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => ['deal', 'lost'].includes(i.status));
  }

  byStatus(status: InquiryStatus): Inquiry[] {
    return this.inquiries.filter((i) => i.status === status);
  }

  statusClass(status: InquiryStatus): string {
    const map: Record<InquiryStatus, string> = {
      new_inquiry: 'badge-blue',
      rfq: 'badge-yellow',
      price_approval: 'badge-orange',
      quotation_sent: 'badge-teal',
      follow_up: 'badge-purple',
      deal: 'badge-green',
      lost: 'badge-red',
      ready_to_purchase: 'badge-indigo',
    };
    return map[status] ?? 'badge-gray';
  }

  openCreate(): void {
    this.showCreate = true;
    this.showImport = false;
    this.form = {};
    this.detailInquiry = null;
    this.editInquiry = null;
  }

  cancelCreate(): void {
    this.showCreate = false;
  }

  openImport(): void {
    this.showImport = true;
    this.showCreate = false;
    this.importFile = null;
    this.error = '';
    this.success = '';
  }

  cancelImport(): void {
    this.showImport = false;
    this.importFile = null;
  }

  async submitCreate(): Promise<void> {
    this.error = '';
    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }
    if (!this.form.customer?.trim() || !this.form.namaBarang?.trim()) {
      this.error = 'Customer and nama barang are required.';
      return;
    }
    const payload: InquiryCreate = {
      customer: this.form.customer!.trim(),
      salesPic: user.name,
      namaBarang: this.form.namaBarang!.trim(),
      spesifikasi: this.form.spesifikasi?.trim(),
      qty: this.form.qty,
      itemUom: this.form.itemUom?.trim(),
      itemNeedByDate: this.form.itemNeedByDate,
      itemManufacturerName: this.form.itemManufacturerName?.trim(),
      itemManufacturerPartNumber: this.form.itemManufacturerPartNumber?.trim(),
      itemClassificationOfGoods: this.form.itemClassificationOfGoods?.trim(),
      targetPrice: this.form.targetPrice,
      createdBy: user.username,
      createdByName: user.name,
    };
    await this.inquiryService.create(payload);
    this.success = 'Inquiry created.';
    this.showCreate = false;
    await this.refresh();
  }

  onImportFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files?.[0] ?? null;
  }

  async submitImport(): Promise<void> {
    this.error = '';
    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }
    if (!this.importFile) { this.error = 'Please choose an Excel file.'; return; }

    this.importing = true;
    try {
      const fileBase64 = await this.readFileAsBase64(this.importFile);
      const result = await this.inquiryService.importCoupa({
        fileBase64,
        fileName: this.importFile.name,
        createdBy: user.username,
        createdByName: user.name,
      });
      this.success = `Imported Coupa file. ${result.itemCount} items loaded.`;
      this.showImport = false;
      await this.refresh();
    } catch (err) {
      this.error = 'Failed to import Coupa file.';
    } finally {
      this.importing = false;
    }
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  openDetail(inquiry: Inquiry): void {
    this.detailInquiry = inquiry;
    this.showLog = false;
    this.editingHargaJualId = null;
    this.hargaJualInput = null;
    this.editInquiry = null;
    this.showCreate = false;
    this.showImport = false;
    this.closeNote = '';
    this.rfqNote = '';
    this.itemNotesMap = {};
    this.openCommentItemId = null;
    this.itemNewNote = '';
    this.assigningSalesPic = false;
    this.newSalesPic = '';
    this.cancelReviewItem();
    this.cancelAddItem();
    this.viewingItemId = null;
  }

  closeDetail(): void {
    this.detailInquiry = null;
    this.itemNotesMap = {};
    this.openCommentItemId = null;
    this.itemNewNote = '';
    this.cancelReviewItem();
    this.cancelAddItem();
    this.viewingItemId = null;
  }

  isAdminOrManager(): boolean {
    const role = this.authService.getCurrentUser()?.role;
    return role === 'admin' || role === 'manager';
  }

  async saveSalesPic(): Promise<void> {
    if (!this.newSalesPic || !this.detailInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    await this.inquiryService.assignSales(this.detailInquiry.id, this.newSalesPic, user.username, user.name, user.role);
    this.assigningSalesPic = false;
    this.newSalesPic = '';
    await this.refresh();
    this.detailInquiry = this.inquiries.find((i) => i.id === this.detailInquiry!.id) ?? this.detailInquiry;
  }

  canComment(): boolean {
    const user = this.authService.getCurrentUser();
    if (!user || !this.detailInquiry) return false;
    const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
    const isAssigned = user.name === this.detailInquiry.salesPic || user.name === this.detailInquiry.sourcingPic;
    return isAdminOrManager || isAssigned;
  }

  async toggleItemComments(item: InquiryItem): Promise<void> {
    if (this.openCommentItemId === item.id) {
      this.openCommentItemId = null;
    } else {
      this.openCommentItemId = item.id;
      this.itemNewNote = '';
      if (!this.itemNotesMap[item.id]) {
        await this.loadItemNotes(this.detailInquiry!.id, item.id);
      }
    }
  }

  async loadItemNotes(inquiryId: string, itemId: string): Promise<void> {
    this.itemNotesMap[itemId] = await this.inquiryService.getItemNotes(inquiryId, itemId);
  }

  async submitItemNote(inquiry: Inquiry, item: InquiryItem): Promise<void> {
    if (!this.itemNewNote.trim()) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.itemSubmittingNote = true;
    try {
      await this.inquiryService.addItemNote(inquiry.id, item.id, this.itemNewNote, user.username, user.name, user.role);
      this.itemNewNote = '';
      await this.loadItemNotes(inquiry.id, item.id);
    } finally {
      this.itemSubmittingNote = false;
    }
  }

  toggleViewItem(itemId: string): void {
    this.viewingItemId = this.viewingItemId === itemId ? null : itemId;
  }

  startReviewItem(item: InquiryItem): void {
    this.reviewingItemId = item.id;
    this.reviewItemForm = { targetPrice: item.targetPrice, itemImage: item.itemImage };
    this.showAddItem = false;
  }

  cancelReviewItem(): void {
    this.reviewingItemId = null;
    this.reviewItemForm = {};
  }

  startEditHargaJual(item: InquiryItem): void {
    this.editingHargaJualId = item.id;
    this.hargaJualInput = item.hargaJual ?? null;
  }

  cancelEditHargaJual(): void {
    this.editingHargaJualId = null;
    this.hargaJualInput = null;
  }

  async saveHargaJual(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user || !this.editingHargaJualId || !this.hargaJualInput) return;
    this.error = '';
    await this.inquiryService.updateHargaJual(inquiry.id, this.editingHargaJualId, this.hargaJualInput, user.username, user.name);
    this.cancelEditHargaJual();
    await this.refreshDetail(inquiry.id);
  }

  async saveReviewItem(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user || !this.reviewingItemId) return;
    this.error = '';
    await this.inquiryService.reviewItem(inquiry.id, this.reviewingItemId, {
      targetPrice: this.reviewItemForm.targetPrice,
      itemImage: this.reviewItemForm.itemImage,
      doneBy: user.username,
      doneByName: user.name,
    });
    this.cancelReviewItem();
    await this.refreshDetail(inquiry.id);
  }

  async onReviewImageChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await this.processImage(file);
    if (result) this.reviewItemForm = { ...this.reviewItemForm, itemImage: result };
  }

  removeReviewImage(): void {
    this.reviewItemForm = { ...this.reviewItemForm, itemImage: undefined };
  }

  openImagePreview(url: string, event: Event): void {
    event.stopPropagation();
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  openAddItem(): void {
    this.showAddItem = true;
    this.addItemForm = {};
    this.cancelReviewItem();
  }

  cancelAddItem(): void {
    this.showAddItem = false;
    this.addItemForm = {};
  }

  async submitAddItem(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    if (!this.addItemForm.itemName?.trim()) { this.error = 'Item name is required.'; return; }
    await this.inquiryService.addItem(inquiry.id, {
      itemName: this.addItemForm.itemName.trim(),
      itemQuantity: this.addItemForm.itemQuantity,
      itemUom: this.addItemForm.itemUom?.trim(),
      itemNeedByDate: this.addItemForm.itemNeedByDate,
      itemManufacturerName: this.addItemForm.itemManufacturerName?.trim(),
      itemManufacturerPartNumber: this.addItemForm.itemManufacturerPartNumber?.trim(),
      itemClassificationOfGoods: this.addItemForm.itemClassificationOfGoods?.trim(),
      itemExtendedDescription: this.addItemForm.itemExtendedDescription?.trim(),
      targetPrice: this.addItemForm.targetPrice,
      itemImage: this.addItemForm.itemImage,
      doneBy: user.username,
      doneByName: user.name,
    });
    this.cancelAddItem();
    await this.refreshDetail(inquiry.id);
  }

  async onAddItemImageChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await this.processImage(file);
    if (result) this.addItemForm = { ...this.addItemForm, itemImage: result };
  }

  private processImage(file: File): Promise<string | null> {
    const MAX_RAW_BYTES = 1024 * 1024;       // 1 MB hard cap
    const MAX_EDGE = 1280;                    // longest edge
    const TARGET_MAX_BYTES = 500 * 1024;     // 500 KB target ceiling

    if (file.size > MAX_RAW_BYTES) {
      this.error = 'Image must be under 1 MB.';
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > MAX_EDGE || height > MAX_EDGE) {
          if (width >= height) {
            height = Math.round((height * MAX_EDGE) / width);
            width = MAX_EDGE;
          } else {
            width = Math.round((width * MAX_EDGE) / height);
            height = MAX_EDGE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

        const b64Bytes = (d: string) => Math.round((d.length - d.indexOf(',') - 1) * 0.75);

        // Try quality levels until we land under 500 KB
        for (const q of [0.85, 0.7, 0.55, 0.4]) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          if (b64Bytes(dataUrl) <= TARGET_MAX_BYTES) {
            resolve(dataUrl);
            return;
          }
        }
        // Last resort — lowest quality still within reason
        resolve(canvas.toDataURL('image/jpeg', 0.3));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        this.error = 'Failed to load image.';
        resolve(null);
      };

      img.src = objectUrl;
    });
  }

  private async refreshDetail(inquiryId: string): Promise<void> {
    await this.refresh();
    if (this.detailInquiry) {
      this.detailInquiry = this.inquiries.find((i) => i.id === inquiryId) ?? null;
    }
  }

  startEdit(inquiry: Inquiry): void {
    if (!this.isSingleItem(inquiry)) {
      this.error = 'Edit hanya tersedia untuk inquiry dengan 1 item.';
      return;
    }
    this.editInquiry = inquiry;
    const item = inquiry.items[0];
    this.editForm = {
      customer: inquiry.customer,
      salesPic: inquiry.salesPic,
      namaBarang: item?.itemName,
      spesifikasi: item?.itemExtendedDescription,
      qty: item?.itemQuantity,
      itemUom: item?.itemUom,
      itemNeedByDate: item?.itemNeedByDate,
      itemManufacturerName: item?.itemManufacturerName,
      itemManufacturerPartNumber: item?.itemManufacturerPartNumber,
      itemClassificationOfGoods: item?.itemClassificationOfGoods,
      targetPrice: item?.targetPrice,
    };
    this.detailInquiry = null;
  }

  cancelEdit(): void {
    this.editInquiry = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editInquiry) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    await this.inquiryService.update(this.editInquiry.id, {
      ...this.editForm,
      updatedBy: user.username,
      updatedByName: user.name,
    });
    this.success = 'Inquiry updated.';
    this.editInquiry = null;
    await this.refresh();
  }

  async sendRfq(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    await this.inquiryService.sendRfq(inquiry.id, user.username, user.name, this.rfqNote);
    this.success = 'RFQ sent to Sourcing.';
    this.detailInquiry = null;
    await this.refresh();
  }

  async close(inquiry: Inquiry, outcome: 'deal' | 'lost'): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    await this.inquiryService.close(inquiry.id, outcome, user.username, user.name, this.closeNote);
    this.success = `Closed as ${outcome}.`;
    this.detailInquiry = null;
    await this.refresh();
  }

  formatDateOnly(iso?: string): string {
    if (!iso) return '-';
    return this.formatDate(iso.slice(0, 10));
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

  itemCount(inquiry: Inquiry): number {
    return inquiry.items?.length ?? 0;
  }

  isSingleItem(inquiry: Inquiry): boolean {
    return this.itemCount(inquiry) === 1;
  }

  firstItemName(inquiry: Inquiry): string {
    return inquiry.items?.[0]?.itemName ?? '-';
  }

  async exportCoupa(inquiry: Inquiry): Promise<void> {
    this.error = '';
    try {
      const blob = await this.inquiryService.exportCoupa(inquiry.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = inquiry.coupaFileName ?? `${inquiry.rfqNo ?? 'coupa'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error = 'Failed to export Coupa file.';
    }
  }
}