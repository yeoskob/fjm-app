export type InquiryStatus =
  | 'new_inquiry'
  | 'rfq'
  | 'price_approval'
  | 'price_approved'
  | 'quotation_sent'
  | 'follow_up'
  | 'ready_to_purchase'
  | 'missed'
  | 'unsent';

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new_inquiry: 'New Inquiry',
  rfq: 'RFQ to Sourcing',
  price_approval: 'Price Approval',
  price_approved: 'Price Approved',
  quotation_sent: 'Quotation Sent',
  follow_up: 'Price Review',
  ready_to_purchase: 'Ready to Purchase',
  missed: 'Missed',
  unsent: 'Unsent',
};

export interface ActivityLog {
  id: string;
  inquiryId: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  note?: string;
  doneBy: string;
  doneByName: string;
  createdAt: string;
}

export interface InquiryItem {
  id: string;
  inquiryId: string;
  coupaRowIndex?: number;
  lotId?: string;
  lotName?: string;
  lotExpectedQuantity?: number;
  lotQuantityNote?: string;
  coupaItemId?: string;
  itemName?: string;
  itemQuantity?: number;
  itemUom?: string;
  itemNeedByDate?: string;
  itemManufacturerName?: string;
  itemManufacturerPartNumber?: string;
  itemClassificationOfGoods?: string;
  itemExtendedDescription?: string;
  itemFiscalCode?: string;
  itemImage?: string;
  coupaBidId?: string;
  bidCapacity?: number;
  bidPriceAmount?: number;
  bidPriceCurrency?: string;
  bidLeadTime?: string;
  bidSupplierItemName?: string;
  bidItemPartNumber?: string;
  bidItemDescription?: string;
  bidShippingTerm?: string;
  alternateName?: string;
  approvedPrice?: number;
  supplier?: string;
  hargaBeli?: number;
  leadTime?: string;
  moq?: number;
  stockAvailability?: string;
  termPembayaran?: string;
  hargaJual?: number;
  margin?: number;
  leadTimeCustomer?: string;
  validitasQuotation?: string;
  catatanQuotation?: string;
  priceApproved?: boolean;
  needsPriceReview?: boolean;
  reviewStatus?: 'pending' | 'approved' | 'review' | 'rejected';
  reviewRound?: number;
  sourcingMissed?: boolean;
  ppnType?: 'incl_ppn' | 'excl_ppn' | 'non_ppn' | null;
}

export interface Inquiry {
  id: string;
  rfqNo?: string;
  tanggal: string;
  customer: string;
  salesPic: string;
  sourcingPic?: string;
  items: InquiryItem[];
  status: InquiryStatus;
  coupaSource?: boolean;
  organization?: string;
  coupaFileName?: string;
  createdAt: string;
  createdBy: string;
  needByDate?: string;
  updatedAt?: string;
  updatedBy?: string;
  sentIncomplete?: boolean;
  sentIncompleteReason?: string | null;
  sourcingMissed?: boolean;
  priceApprovalStartedAt?: string | null;
  activityLog?: ActivityLog[];
}

function isItemInPriceReview(item: Pick<InquiryItem, 'needsPriceReview' | 'reviewStatus'>): boolean {
  return item.needsPriceReview === true || item.reviewStatus === 'review';
}

export function getInquiryDisplayStatus(inquiry: Pick<Inquiry, 'status'> & { items?: Array<Pick<InquiryItem, 'needsPriceReview' | 'reviewStatus'>> }): InquiryStatus {
  if (inquiry.status === 'follow_up') return 'follow_up';
  if (
    ['price_approved', 'quotation_sent'].includes(inquiry.status) &&
    (inquiry.items ?? []).some((item) => isItemInPriceReview(item))
  ) {
    return 'follow_up';
  }
  return inquiry.status;
}

export interface InquiryNote {
  id: string;
  inquiryId: string;
  itemId: string;
  note: string;
  role: string;
  doneBy: string;
  doneByName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface InquiryCreate {
  customer: string;
  salesPic: string;
  organization: string;
  namaBarang: string;
  spesifikasi?: string;
  qty?: number;
  itemUom?: string;
  itemNeedByDate?: string;
  itemManufacturerName?: string;
  itemManufacturerPartNumber?: string;
  itemClassificationOfGoods?: string;
  itemImage?: string;
  deadlineQuotation?: string;
  lampiran?: string;
  createdBy: string;
  createdByName: string;
}

export interface SourcingInfo {
  supplier: string;
  hargaBeli: number;
  leadTime: string;
  moq?: number;
  stockAvailability?: string;
  termPembayaran?: string;
  alternateName?: string;
  ppnType?: 'incl_ppn' | 'excl_ppn' | 'non_ppn' | null;
  doneBy: string;
  doneByName: string;
}

export interface PriceApproval {
  hargaJual: number;
  leadTimeCustomer?: string;
  validitasQuotation?: string;
  catatanQuotation?: string;
  doneBy: string;
  doneByName: string;
}

export interface DashboardStats {
  total: number;
  thisMonth: number;
  quotationSent: number;
  unsent: number;
  conversionRate: number;
  topSales: Array<{ sales_pic: string; sent_count: number }>;
  topMarketing: Array<{ sales_pic: string; sent_count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  sourcingPending: number;
  sourcingItemsThisMonth: number;
  sourcingItemsTotal: number;
  topSourcers: Array<{ sourcing_pic: string; items_count: number }>;
  itemsTerisi: number;
  itemsTidakTerisi: number;
  itemsMissed: number;
  itemsMissedUnassigned: number;
  rfqsMissed: number;
  rfqsMissedUnassigned: number;
  urgentRfqs: Array<{ id: string; rfq_no: string; customer: string; sourcing_pic: string | null; deadline_quotation: string; days_left: number }>;
}

export interface ReportRow {
  id: string;
  rfq_no: string;
  customer: string;
  sales_pic: string;
  tanggal: string;
  status: string;
  need_by_date: string | null;
  timeline_days: number | null;
  days_taken: number | null;
}
export interface ReportData {
  rows: ReportRow[];
}

export interface ReportSourcingRow {
  id: string;
  rfq_no: string;
  customer: string;
  sales_pic: string;
  sourcing_pic: string | null;
  tanggal: string;
  status: string;
  need_by_date: string | null;
  total_items: number;
  sourced_items: number;
}

export interface ReportSourcingData {
  rows: ReportSourcingRow[];
}

export interface UserStats {
  salesStats: {
    total: number;
    thisMonth: number;
    quotationSent: number;
    unsent: number;
    active: number;
    conversionRate: number;
    statusBreakdown: Array<{ status: string; count: number }>;
  };
  sourcingStats: {
    itemsSourced: number;
    inquiriesContributed: number;
    thisMonth: number;
    itemsTerisi: number;
    itemsMissed: number;
    itemsTidakTerisi: number;
  };
  managerStats: {
    approvalsTotal: number;
    approvalsThisMonth: number;
    inquiriesApproved: number;
  };
}

