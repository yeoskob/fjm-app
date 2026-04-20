import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { Inquiry, InquiryItem } from '../../models/inquiry';

type SortState = { col: string; dir: 'asc' | 'desc' };

@Component({
  selector: 'app-purchasing',
  templateUrl: './purchasing.component.html',
  styleUrls: ['./purchasing.component.scss'],
})
export class PurchasingComponent implements OnInit {
  activeTab: 'ready_to_purchase' = 'ready_to_purchase';

  canSeeTab(tab: string): boolean {
    return this.authService.hasTab('purchasing', tab);
  }
  inquiries: Inquiry[] = [];
  loading = false;
  busy: Record<string, boolean> = {};
  filter = '';
  expandedId: string | null = null;

  rtpSort: SortState = { col: '', dir: 'asc' };

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.inquiries = await this.inquiryService.getAll();
    this.loading = false;
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
      else if (sort.col === 'items') { av = a.items.length; bv = b.items.length; }
      else if (sort.col === 'tanggal') { av = a.tanggal; bv = b.tanggal; }
      return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
    });
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
