import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { SettingsService } from '../../services/settings.service';
import { Inquiry, InquiryCreate, InquiryItem, InquiryNote, InquiryStatus, INQUIRY_STATUS_LABELS } from '../../models/inquiry';
import { todayLocalISO } from '../../utils/date';

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
  busy: Record<string, boolean> = {};

  showCreate = false;
  form: Partial<InquiryCreate> = {};
  createCustomer = '';
  createNeedByDate = '';
  createOrganization = '';
  createItems: Array<{ itemName: string; itemQuantity?: number; itemUom?: string; itemExtendedDescription?: string; itemImage?: string }> = [];
  submittingCreate = false;
  showImport = false;
  importFile: File | null = null;
  importOrganization = '';
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
  reviewItemForm: { itemImage?: string } = {};
  editingHargaJualId: string | null = null;
  hargaJualInput: number | null = null;
  viewingItemId: string | null = null;
  reviewedItemIds = new Set<string>();
  showPriceReviewModal = false;
  priceReviewReason = '';
  showAddItem = false;
  addItemForm: { itemName?: string; itemQuantity?: number; itemUom?: string; itemNeedByDate?: string; itemManufacturerName?: string; itemManufacturerPartNumber?: string; itemClassificationOfGoods?: string; itemExtendedDescription?: string; itemImage?: string } = {};
  previewImageUrl: string | null = null;

  activeTab: 'rfq' | 'price_approved' | 'sent' = 'rfq';

  readonly pageSize = 10;
  rfqPage = 1;
  priceApprovedPage = 1;
  quotationPage = 1;

  canSeeTab(tab: string): boolean {
    return this.authService.hasTab('marketing', tab);
  }

  readonly today = todayLocalISO();

  readonly UOM_OPTIONS = [
    // Count
    'Pcs', 'Unit', 'Set', 'Pair', 'Dozen',
    // Weight
    'Kg', 'g', 'Ton', 'Lbs',
    // Length
    'm', 'cm', 'mm', 'ft', 'inch',
    // Area
    'm²', 'cm²',
    // Volume
    'L', 'mL', 'm³',
    // Packaging
    'Box', 'Carton', 'Pack', 'Roll', 'Sheet', 'Drum', 'Pallet', 'Bundle', 'Bag', 'Spool',
  ];
  organizationOptions: string[] = ['FJM', 'FMI', 'FSA'];

  readonly STATUS_LABELS = INQUIRY_STATUS_LABELS;
  readonly PIPELINE_STAGES: InquiryStatus[] = [
    'new_inquiry', 'rfq', 'price_approval', 'price_approved', 'quotation_sent', 'deal', 'lost'
  ];

  rfqFilter = ''; rfqSort = { col: 'needByDate', dir: 'asc' as 'asc'|'desc' };
  priceApprovedFilter = ''; priceApprovedSort = { col: 'needByDate', dir: 'asc' as 'asc'|'desc' };
  quotationFilter = ''; quotationSort = { col: 'needByDate', dir: 'asc' as 'asc'|'desc' };

  // Price editing for price_approved status
  editingPriceApprovedItemId: string | null = null;
  priceApprovedInput: number | null = null;
  priceApprovedMinPrice: number | null = null;
  priceApprovedError = '';

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
        else if (sort.col === 'needByDate') {
          const earliest = (inq: Inquiry) => inq.items.map(i => i.itemNeedByDate).filter(Boolean).sort()[0] ?? '';
          av = earliest(a); bv = earliest(b);
          // push empty dates to the bottom regardless of direction
          if (!av) return 1;
          if (!bv) return -1;
        }
        return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
      });
    }
    return r;
  }

  get rfqTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'new_inquiry');
  }

  get priceApprovedTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'price_approved');
  }

  get quotationTabInquiries(): Inquiry[] {
    return this.inquiries.filter((i) => i.status === 'quotation_sent');
  }


  get rfqTabFiltered(): Inquiry[] { return this.applyFS(this.rfqTabInquiries, this.rfqFilter, this.rfqSort); }
  get priceApprovedTabFiltered(): Inquiry[] { return this.applyFS(this.priceApprovedTabInquiries, this.priceApprovedFilter, this.priceApprovedSort); }
  get quotationTabFiltered(): Inquiry[] { return this.applyFS(this.quotationTabInquiries, this.quotationFilter, this.quotationSort); }

  get pagedRfq(): Inquiry[] { const s = (this.rfqPage - 1) * this.pageSize; return this.rfqTabFiltered.slice(s, s + this.pageSize); }
  get pagedPriceApproved(): Inquiry[] { const s = (this.priceApprovedPage - 1) * this.pageSize; return this.priceApprovedTabFiltered.slice(s, s + this.pageSize); }
  get pagedQuotation(): Inquiry[] { const s = (this.quotationPage - 1) * this.pageSize; return this.quotationTabFiltered.slice(s, s + this.pageSize); }

  rfqPages(): number { return Math.ceil(this.rfqTabFiltered.length / this.pageSize); }
  priceApprovedPages(): number { return Math.ceil(this.priceApprovedTabFiltered.length / this.pageSize); }
  quotationPages(): number { return Math.ceil(this.quotationTabFiltered.length / this.pageSize); }

  earliestNeedByDate(inq: Inquiry): string {
    const dates = inq.items
      .map((it) => it.itemNeedByDate)
      .filter((d): d is string => !!d)
      .sort();
    return dates.length ? this.formatDate(dates[0]) : '-';
  }

  /** Columns where marketing/sales can take action */
  isActionable(stage: InquiryStatus): boolean {
    return ['new_inquiry', 'price_approved', 'quotation_sent'].includes(stage);
  }

  /** Columns where marketing is waiting on another team */
  isWaiting(stage: InquiryStatus): boolean {
    return ['rfq', 'price_approval'].includes(stage);
  }

  /** Closed outcome columns */
  isClosed(stage: InquiryStatus): boolean {
    return ['deal', 'lost'].includes(stage);
  }

  constructor(
    private inquiryService: InquiryService,
    private settingsService: SettingsService,
    public authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('admin');
    const tabs: Array<'rfq' | 'price_approved' | 'sent'> = ['rfq', 'price_approved', 'sent'];
    const qTab = this.route.snapshot.queryParamMap.get('tab') as typeof tabs[number] | null;
    this.activeTab = (qTab && tabs.includes(qTab) && this.canSeeTab(qTab))
      ? qTab
      : (tabs.find((t) => this.canSeeTab(t)) ?? 'rfq');
    void this.refresh();
    const user = this.authService.getCurrentUser();
    if (user?.role === 'admin' || user?.role === 'manager') {
      void this.inquiryService.getUsers().then((users) => {
        this.salesUsers = users.filter((u) => u.role === 'marketing');
      });
    }
    void this.loadOrganizationOptions();
  }

  private async loadOrganizationOptions(): Promise<void> {
    try {
      const orgs = await this.settingsService.getOrganizations();
      const codes = orgs
        .map((o) => String(o.code ?? '').trim().toUpperCase())
        .filter((code) => !!code);
      if (codes.length > 0) {
        this.organizationOptions = Array.from(new Set(codes)).sort();
      }
    } catch {
      // Keep fallback defaults when settings API is unavailable
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
      price_approved: 'badge-teal',
      quotation_sent: 'badge-purple',
      follow_up: 'badge-purple',
      deal: 'badge-green',
      lost: 'badge-red',
      ready_to_purchase: 'badge-indigo',
    };
    return map[status] ?? 'badge-gray';
  }

  organizationClass(org?: string): string {
    if (org === 'FMI') return 'org-badge-fmi';
    if (org === 'FSA') return 'org-badge-fsa';
    return 'org-badge-fjm';
  }

  openCreate(): void {
    this.showCreate = true;
    this.showImport = false;
    this.createCustomer = '';
    this.createNeedByDate = '';
    this.createOrganization = '';
    this.createItems = [{ itemName: '' }];
    this.error = '';
    this.detailInquiry = null;
    this.editInquiry = null;
  }

  cancelCreate(): void {
    this.showCreate = false;
  }

  addCreateItem(): void {
    this.createItems.push({ itemName: '' });
  }

  removeCreateItem(index: number): void {
    if (this.createItems.length > 1) this.createItems.splice(index, 1);
  }

  async onCreateItemImage(event: Event, index: number): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await this.processImage(file);
    if (result) this.createItems[index].itemImage = result;
  }

  openImport(): void {
    this.showImport = true;
    this.showCreate = false;
    this.importFile = null;
    this.importOrganization = '';
    this.error = '';
    this.success = '';
  }

  cancelImport(): void {
    this.showImport = false;
    this.importFile = null;
    this.importOrganization = '';
  }

  async submitCreate(): Promise<void> {
    this.error = '';
    const user = this.authService.getCurrentUser();
    if (!user) { this.error = 'Not logged in.'; return; }
    if (!this.createCustomer.trim()) { this.error = 'Customer is required.'; return; }
    if (!this.createOrganization) { this.error = 'Organization is required.'; return; }
    const validItems = this.createItems.filter(i => i.itemName.trim());
    if (validItems.length === 0) { this.error = 'Add at least one item with a name.'; return; }

    this.submittingCreate = true;
    try {
      const first = validItems[0];
      const { id } = await this.inquiryService.create({
        customer: this.createCustomer.trim(),
        salesPic: user.name,
        organization: this.createOrganization,
        namaBarang: first.itemName.trim(),
        spesifikasi: first.itemExtendedDescription?.trim(),
        qty: first.itemQuantity,
        itemUom: first.itemUom?.trim(),
        itemNeedByDate: this.createNeedByDate || undefined,
        itemImage: first.itemImage,
        createdBy: user.username,
        createdByName: user.name,
      });
      // Add remaining items
      for (const item of validItems.slice(1)) {
        await this.inquiryService.addItem(id, {
          itemName: item.itemName.trim(),
          itemQuantity: item.itemQuantity,
          itemUom: item.itemUom?.trim(),
          itemExtendedDescription: item.itemExtendedDescription?.trim(),
          itemImage: item.itemImage,
          itemNeedByDate: this.createNeedByDate || undefined,
          doneBy: user.username,
          doneByName: user.name,
        });
      }
      this.success = 'Inquiry created.';
      this.showCreate = false;
      await this.refresh();
    } catch {
      this.error = 'Failed to create inquiry.';
    } finally {
      this.submittingCreate = false;
    }
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
    if (!this.importOrganization) { this.error = 'Organization is required.'; return; }

    this.importing = true;
    try {
      const fileBase64 = await this.readFileAsBase64(this.importFile);
      const result = await this.inquiryService.importCoupa({
        fileBase64,
        fileName: this.importFile.name,
        createdBy: user.username,
        createdByName: user.name,
        organization: this.importOrganization,
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
    this.editingPriceApprovedItemId = null;
    this.priceApprovedInput = null;
    this.priceApprovedMinPrice = null;
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
    this.reviewedItemIds = new Set<string>();
  }

  closeDetail(): void {
    this.detailInquiry = null;
    this.itemNotesMap = {};
    this.openCommentItemId = null;
    this.itemNewNote = '';
    this.cancelReviewItem();
    this.cancelAddItem();
    this.closePriceReviewModal();
    this.viewingItemId = null;
    this.reviewedItemIds = new Set<string>();
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
      return;
    }
    this.openCommentItemId = item.id;
    this.itemNewNote = '';
    if (!this.itemNotesMap[item.id]) {
      await this.loadItemNotes(this.detailInquiry!.id, item.id);
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
    if (this.viewingItemId === itemId) {
      this.viewingItemId = null;
      this.openCommentItemId = null;
      return;
    }
    this.viewingItemId = itemId;
    this.reviewedItemIds.add(itemId);
    const item = this.detailInquiry?.items.find((i) => i.id === itemId);
    if (item) {
      void this.toggleItemComments(item);
    }
  }

  startReviewItem(item: InquiryItem): void {
    this.reviewingItemId = item.id;
    this.reviewItemForm = { itemImage: item.itemImage };
    this.showAddItem = false;
    void this.toggleItemComments(item);
  }

  cancelReviewItem(): void {
    this.reviewingItemId = null;
    this.reviewItemForm = {};
    this.openCommentItemId = null;
  }

  startEditHargaJual(item: InquiryItem): void {
    this.editingHargaJualId = item.id;
    this.hargaJualInput = this.getApprovedPrice(item) ?? null;
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
    const MAX_RAW_BYTES = 20 * 1024 * 1024;  // 20 MB input cap
    const MAX_EDGE = 1280;                    // longest edge
    const TARGET_MAX_BYTES = 500 * 1024;     // 500 KB target ceiling

    if (file.size > MAX_RAW_BYTES) {
      this.error = 'Image must be under 20 MB.';
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
      organization: inquiry.organization ?? 'FJM',
      salesPic: inquiry.salesPic,
      namaBarang: item?.itemName,
      spesifikasi: item?.itemExtendedDescription,
      qty: item?.itemQuantity,
      itemUom: item?.itemUom,
      itemNeedByDate: item?.itemNeedByDate,
      itemManufacturerName: item?.itemManufacturerName,
      itemManufacturerPartNumber: item?.itemManufacturerPartNumber,
      itemClassificationOfGoods: item?.itemClassificationOfGoods,
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

  async sendToSent(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    try {
      await this.inquiryService.sendToSent(inquiry.id, user.username, user.name);
      this.success = 'Quotation sent to customer.';
      this.detailInquiry = null;
      await this.refresh();
    } catch (e: any) {
      this.error = e?.error?.error ?? 'Failed to send quotation.';
    }
  }

  openPriceReviewModal(_inquiry: Inquiry): void {
    this.priceReviewReason = '';
    this.showPriceReviewModal = true;
    this.error = '';
  }

  closePriceReviewModal(): void {
    this.showPriceReviewModal = false;
    this.priceReviewReason = '';
  }

  async confirmReturnToPriceApproval(): Promise<void> {
    if (!this.detailInquiry) return;
    const reason = this.priceReviewReason.trim();
    if (!reason) {
      this.error = 'Reason for Price Review is required.';
      return;
    }
    await this.returnToPriceApproval(this.detailInquiry, reason);
  }

  async returnToPriceApproval(inquiry: Inquiry, reviewReason: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.error = '';
    try {
      await this.inquiryService.returnToPriceApproval(inquiry.id, user.username, user.name, reviewReason);
      this.success = 'Sent back to Price Approval for review.';
      this.closePriceReviewModal();
      this.detailInquiry = null;
      await this.refresh();
    } catch (e: any) {
      this.error = e?.error?.error ?? 'Failed to return to price approval.';
    }
  }

  startEditPriceApproved(item: InquiryItem): void {
    this.editingPriceApprovedItemId = item.id;
    this.priceApprovedMinPrice = this.getApprovedFloor(item) ?? 0;
    this.priceApprovedInput = this.getSellingPrice(item) ?? null;
    this.priceApprovedError = '';
  }

  cancelEditPriceApproved(): void {
    this.editingPriceApprovedItemId = null;
    this.priceApprovedInput = null;
    this.priceApprovedMinPrice = null;
    this.priceApprovedError = '';
  }

  isPriceApprovedBelowMin(): boolean {
    if (this.priceApprovedInput == null || this.priceApprovedMinPrice == null) return false;
    return this.priceApprovedInput < this.priceApprovedMinPrice;
  }

  itemsBelowApprovedFloor(inquiry: Inquiry): InquiryItem[] {
    return inquiry.items.filter((item) => this.isItemBelowApprovedFloor(item));
  }

  reviewNeededItems(inquiry: Inquiry): InquiryItem[] {
    return inquiry.items.filter((item) => item.needsPriceReview === true || item.reviewStatus === 'review');
  }

  rejectedItems(inquiry: Inquiry): InquiryItem[] {
    return this.reviewNeededItems(inquiry);
  }

  rejectedItemCount(inquiry: Inquiry): number {
    return this.reviewNeededItems(inquiry).length;
  }

  sourcingTidakTerisiItems(inquiry: Inquiry): InquiryItem[] {
    return inquiry.items.filter((item) => this.isSourcingTidakTerisi(item));
  }

  isSourcingTidakTerisi(item: InquiryItem): boolean {
    return !(item.supplier && item.hargaBeli != null && item.leadTime);
  }

  unresolvedItems(inquiry: Inquiry): InquiryItem[] {
    return inquiry.items.filter((item) =>
      item.priceApproved !== true ||
      item.needsPriceReview === true ||
      item.reviewStatus === 'review' ||
      this.isItemBelowApprovedFloor(item)
    );
  }

  itemsForPriceReview(inquiry: Inquiry): InquiryItem[] {
    return inquiry.items.filter((item) =>
      this.isSourcingTidakTerisi(item) ||
      item.reviewStatus === 'review' ||
      item.needsPriceReview === true ||
      this.isItemBelowApprovedFloor(item)
    );
  }

  isItemBelowApprovedFloor(item: InquiryItem): boolean {
    const currentSellingPrice = this.getSellingPrice(item);
    const approvedFloor = this.getApprovedFloor(item);
    return (
      currentSellingPrice != null &&
      approvedFloor != null &&
      currentSellingPrice < approvedFloor
    );
  }

  hasReviewedAllItems(inquiry: Inquiry): boolean {
    return inquiry.items.every((item) => this.reviewedItemIds.has(item.id));
  }

  unreviewedItemCount(inquiry: Inquiry): number {
    return inquiry.items.filter((item) => !this.reviewedItemIds.has(item.id)).length;
  }

  isItemReviewed(item: InquiryItem): boolean {
    return this.reviewedItemIds.has(item.id);
  }

  async savePriceApproved(inquiry: Inquiry): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user || !this.editingPriceApprovedItemId || this.priceApprovedInput == null) return;
    this.priceApprovedError = '';
    await this.inquiryService.updateHargaJual(inquiry.id, this.editingPriceApprovedItemId, this.priceApprovedInput, user.username, user.name);
    this.cancelEditPriceApproved();
    await this.refreshDetail(inquiry.id);
  }

  async close(inquiry: Inquiry, outcome: 'deal' | 'lost'): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    await this.inquiryService.close(inquiry.id, outcome, user.username, user.name, this.closeNote);
    this.success = `Closed as ${outcome}.`;
    this.detailInquiry = null;
    await this.refresh();
  }

  async moveToReadyToPurchase(inquiry: Inquiry, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.busy[inquiry.id]) return;
    this.busy[inquiry.id] = true;
    const user = this.authService.getCurrentUser();
    await this.inquiryService.readyToPurchase(inquiry.id, user?.id ?? '', user?.name ?? '');
    await this.refresh();
    this.busy[inquiry.id] = false;
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
    const h = d.getHours(), m = d.getMinutes();
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${datePart}, ${time}`;
  }

  formatCurrency(value?: number): string {
    if (value == null) return '-';
    return 'Rp ' + value.toLocaleString('id-ID');
  }

  getSellingPrice(item: InquiryItem): number | undefined {
    return item.hargaJual ?? item.approvedPrice;
  }

  getApprovedFloor(item: InquiryItem): number | undefined {
    return item.approvedPrice ?? item.hargaJual;
  }

  getApprovedPrice(item: InquiryItem): number | undefined {
    return this.getSellingPrice(item);
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
