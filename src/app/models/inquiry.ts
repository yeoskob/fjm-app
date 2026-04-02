export type InquiryStatus =
  | 'new_inquiry'
  | 'rfq'
  | 'price_approval'
  | 'quotation_sent'
  | 'follow_up'
  | 'deal'
  | 'lost'
  | 'ready_to_purchase';

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new_inquiry: 'New Inquiry',
  rfq: 'RFQ to Sourcing',
  price_approval: 'Price Approval',
  quotation_sent: 'Quotation Sent',
  follow_up: 'Negotiation',
  deal: 'Deal',
  lost: 'Lost',
  ready_to_purchase: 'Ready to Purchase',
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
  targetPrice?: number;
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
  coupaFileName?: string;
  createdAt: string;
  createdBy: string;
  needByDate?: string;
  updatedAt?: string;
  updatedBy?: string;
  activityLog?: ActivityLog[];
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
  namaBarang: string;
  spesifikasi?: string;
  qty?: number;
  itemUom?: string;
  itemNeedByDate?: string;
  itemManufacturerName?: string;
  itemManufacturerPartNumber?: string;
  itemClassificationOfGoods?: string;
  targetPrice?: number;
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
  deals: number;
  lost: number;
  conversionRate: number;
  topSales: Array<{ sales_pic: string; deal_count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

export interface UserStats {
  salesStats: {
    total: number;
    thisMonth: number;
    deals: number;
    lost: number;
    active: number;
    conversionRate: number;
    statusBreakdown: Array<{ status: string; count: number }>;
  };
  sourcingStats: {
    itemsSourced: number;
    inquiriesContributed: number;
    thisMonth: number;
  };
  managerStats: {
    approvalsTotal: number;
    approvalsThisMonth: number;
    inquiriesApproved: number;
  };
}
