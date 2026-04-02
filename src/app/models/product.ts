export interface ProductSource {
  id?: string;
  label: string;
  url: string;
  price?: number;
}

export type ProductStatus = 'pending' | 'approved';

export interface ProductCreate {
  name: string;
  imageDataUrl?: string;
  proposedPrice: number;
  leadTimeMinutes: number;
  sources: ProductSource[];
  createdBy: string;
}

export interface ProductUpdate {
  name: string;
  imageDataUrl?: string | null;
  proposedPrice: number;
  leadTimeMinutes: number;
  sources: ProductSource[];
}

export interface ProductSubmission {
  id: string;
  name: string;
  imageDataUrl?: string;
  proposedPrice: number;
  leadTimeMinutes: number;
  sources: ProductSource[];
  status: ProductStatus;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedPrice?: number;
  approvedSourceId?: string;
}
