import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { Inquiry, InquiryItem } from '../../models/inquiry';

type Tab = 'deal' | 'lost' | 'ready_to_purchase';
type SortState = { col: string; dir: 'asc' | 'desc' };

@Component({
  selector: 'app-purchasing',
  templateUrl: './purchasing.component.html',
  styleUrls: ['./purchasing.component.scss'],
})
export class PurchasingComponent implements OnInit {
  activeTab: Tab = 'deal';

  canSeeTab(tab: string): boolean {
    return this.authService.hasTab('purchasing', tab);
  }
  inquiries: Inquiry[] = [];
  loading = false;
  busy: Record<string, boolean> = {};
  filter = '';
  expandedId: string | null = null;

  dealSort: SortState = { col: '', dir: 'asc' };
  lostSort: SortState = { col: '', dir: 'asc' };
  rtpSort: SortState = { col: '', dir: 'asc' };

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    const tabs: Tab[] = ['deal', 'ready_to_purchase', 'lost'];
    this.activeTab = tabs.find((t) => this.canSeeTab(t)) ?? 'deal';
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.inquiries = await this.inquiryService.getAll();
    this.loading = false;
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.filter = '';
    this.expandedId = null;
  }

  countOf(tab: Tab): number {
    return this.inquiries.filter((i) => i.status === tab).length;
  }

  toggleSort(state: SortState, col: string): void {
    if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.col = col; state.dir = 'asc'; }
  }

  sortIcon(state: SortState, col: string): string {
    return state.col !== col ? '↕' : state.dir === 'asc' ? '↑' : '↓';
  }

  private sortInquiries(items: Inquiry[], sort: SortState): Inquiry[] {
    if (!sort.col) return items;
    return [...items].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sort.col === 'rfqNo') { av = a.rfqNo ?? ''; bv = b.rfqNo ?? ''; }
      else if (sort.col === 'customer') { av = a.customer; bv = b.customer; }
      else if (sort.col === 'salesPic') { av = a.salesPic; bv = b.salesPic; }
      else if (sort.col === 'sourcingPic') { av = a.sourcingPic ?? ''; bv = b.sourcingPic ?? ''; }
      else if (sort.col === 'items') { av = a.items.length; bv = b.items.length; }
      else if (sort.col === 'tanggal') { av = a.tanggal; bv = b.tanggal; }
      else if (sort.col === 'updatedAt') { av = a.updatedAt ?? ''; bv = b.updatedAt ?? ''; }
      return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
    });
  }

  get tabRows(): Inquiry[] {
    const base = this.inquiries.filter((i) => i.status === this.activeTab);
    const sort = this.activeTab === 'deal' ? this.dealSort : this.lostSort;
    const f = this.filter.trim().toLowerCase();
    const filtered = f
      ? base.filter(
          (i) =>
            (i.rfqNo ?? '').toLowerCase().includes(f) ||
            i.customer.toLowerCase().includes(f) ||
            i.salesPic.toLowerCase().includes(f)
        )
      : base;
    return this.sortInquiries(filtered, sort);
  }

  get rtpGroups(): Array<{ inquiry: Inquiry; items: InquiryItem[] }> {
    const f = this.filter.trim().toLowerCase();
    const groups = this.inquiries
      .filter((i) => i.status === 'ready_to_purchase')
      .map((inq) => ({
        inquiry: inq,
        items: f
          ? inq.items.filter(
              (item) =>
                (inq.rfqNo ?? '').toLowerCase().includes(f) ||
                inq.customer.toLowerCase().includes(f) ||
                (item.itemName ?? '').toLowerCase().includes(f) ||
                (item.alternateName ?? '').toLowerCase().includes(f) ||
                (item.supplier ?? '').toLowerCase().includes(f)
            )
          : inq.items,
      }))
      .filter((g) => g.items.length > 0);

    return this.sortInquiries(groups.map((g) => g.inquiry), this.rtpSort)
      .map((inq) => groups.find((g) => g.inquiry.id === inq.id)!);
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  async moveToReadyToPurchase(inq: Inquiry, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.busy[inq.id]) return;
    this.busy[inq.id] = true;
    const user = this.authService.getCurrentUser();
    await this.inquiryService.readyToPurchase(inq.id, user?.id ?? '', user?.name ?? '');
    await this.load();
    this.busy[inq.id] = false;
  }

  itemCount(inq: Inquiry): number {
    return inq.items.length;
  }

  itemDisplayName(item: InquiryItem): string {
    return item.alternateName || item.itemName || '-';
  }

  formatDate(d?: string | null): string {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
