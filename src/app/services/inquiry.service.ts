import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DashboardStats, Inquiry, InquiryCreate, InquiryNote, PriceApproval, ReportData, ReportSourcingData, SourcingInfo, UserStats } from '../models/inquiry';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly base = `${environment.apiUrl}/inquiries`;

  constructor(private http: HttpClient) {}

  getAll(): Promise<Inquiry[]> {
    return firstValueFrom(this.http.get<Inquiry[]>(this.base));
  }

  getById(id: string): Promise<Inquiry> {
    return firstValueFrom(this.http.get<Inquiry>(`${this.base}/${id}`));
  }

  getDashboard(): Promise<DashboardStats> {
    return firstValueFrom(this.http.get<DashboardStats>(`${this.base}/dashboard`));
  }

  create(payload: InquiryCreate): Promise<{ id: string; rfqNo: string }> {
    return firstValueFrom(this.http.post<{ id: string; rfqNo: string }>(this.base, payload));
  }

  importCoupa(payload: { fileBase64: string; fileName: string; createdBy: string; createdByName: string; organization: string }): Promise<{ id: string; rfqNo: string; itemCount: number }> {
    return firstValueFrom(this.http.post<{ id: string; rfqNo: string; itemCount: number }>(`${this.base}/import-coupa`, payload));
  }

  update(id: string, payload: Partial<InquiryCreate> & { updatedBy: string; updatedByName: string }): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.base}/${id}`, payload));
  }

  sendRfq(id: string, doneBy: string, doneByName: string, note?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/send-rfq`, { doneBy, doneByName, note }));
  }

  reviewItem(id: string, itemId: string, payload: { itemImage?: string; doneBy: string; doneByName: string }): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/${id}/items/${itemId}`, payload));
  }

  addItem(id: string, payload: { itemName: string; itemQuantity?: number; itemUom?: string; itemNeedByDate?: string; itemManufacturerName?: string; itemManufacturerPartNumber?: string; itemClassificationOfGoods?: string; itemExtendedDescription?: string; itemImage?: string; doneBy: string; doneByName: string }): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/items`, payload));
  }

  sendToPriceApproval(id: string, doneBy: string, doneByName: string, note?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/send-to-price-approval`, { doneBy, doneByName, note }));
  }

  returnToSourcing(id: string, doneBy: string, doneByName: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/return-to-sourcing`, { doneBy, doneByName }));
  }

  sendToPriceApproved(id: string, doneBy: string, doneByName: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/send-to-price-approved`, { doneBy, doneByName }));
  }

  sendToSent(id: string, doneBy: string, doneByName: string, incompleteReason?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/send-to-sent`, { doneBy, doneByName, incompleteReason }));
  }

  returnToPriceApproval(id: string, doneBy: string, doneByName: string, reviewReason?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/return-to-price-approval`, { doneBy, doneByName, reviewReason }));
  }

  submitSourcingInfo(id: string, payload: SourcingInfo): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/sourcing-info`, payload));
  }

  submitSourcingInfoItem(id: string, itemId: string, payload: SourcingInfo): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/items/${itemId}/sourcing-info`, payload));
  }

  approve(id: string, payload: PriceApproval): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/approve`, payload));
  }

  approveItem(id: string, itemId: string, payload: PriceApproval): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/items/${itemId}/approve`, payload));
  }

  rejectItem(id: string, itemId: string, doneBy: string, doneByName: string, counterPrice: number, reason?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/items/${itemId}/reject`, { doneBy, doneByName, counterPrice, reason }));
  }

  exportCoupa(id: string): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/${id}/export-coupa`, { responseType: 'blob' }));
  }

  followUp(id: string, doneBy: string, doneByName: string, note?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/follow-up`, { doneBy, doneByName, note }));
  }

  readyToPurchase(id: string, doneBy: string, doneByName: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${id}/ready-to-purchase`, { doneBy, doneByName }));
  }

  assignSales(id: string, salesPic: string, doneBy: string, doneByName: string, role: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/${id}/assign-sales`, { salesPic, doneBy, doneByName, role }));
  }

  assignSourcing(id: string, sourcingPic: string | null, doneBy: string, doneByName: string, role: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/${id}/assign-sourcing`, { sourcingPic, doneBy, doneByName, role }));
  }

  getItemNotes(inquiryId: string, itemId: string): Promise<InquiryNote[]> {
    return firstValueFrom(this.http.get<InquiryNote[]>(`${this.base}/${inquiryId}/items/${itemId}/notes`));
  }

  addItemNote(inquiryId: string, itemId: string, note: string, doneBy: string, doneByName: string, role: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/${inquiryId}/items/${itemId}/notes`, { note, doneBy, doneByName, role }));
  }

  updateHargaJual(inquiryId: string, itemId: string, hargaJual: number, doneBy: string, doneByName: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/${inquiryId}/items/${itemId}/harga-jual`, { hargaJual, doneBy, doneByName }));
  }

  getUserStats(name: string): Promise<UserStats> {
    return firstValueFrom(this.http.get<UserStats>(`${this.base}/dashboard/user`, { params: { name } }));
  }

  getUsers(): Promise<Array<{ id: string; name: string; username: string; role: string }>> {
    return firstValueFrom(this.http.get<Array<{ id: string; name: string; username: string; role: string }>>(`${environment.apiUrl}/users`));
  }

  getReport(month?: string, salesPic?: string): Promise<ReportData> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    if (salesPic) params['salesPic'] = salesPic;
    return firstValueFrom(this.http.get<ReportData>(`${this.base}/report`, { params }));
  }

  getSourcingReport(month?: string, sourcingPic?: string): Promise<ReportSourcingData> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    if (sourcingPic) params['sourcingPic'] = sourcingPic;
    return firstValueFrom(this.http.get<ReportSourcingData>(`${this.base}/report/sourcing`, { params }));
  }

  exportReport(
    month?: string, salesPic?: string, status?: string, search?: string,
    audience?: 'marketing' | 'sourcing' | 'purchasing',
    dateField?: 'tanggal' | 'need_by_date', dateFrom?: string, dateTo?: string,
  ): Promise<Blob> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    if (salesPic) params['salesPic'] = salesPic;
    if (status) params['status'] = status;
    if (search) params['search'] = search;
    if (audience) params['audience'] = audience;
    if (dateField) params['dateField'] = dateField;
    if (dateFrom) params['dateFrom'] = dateFrom;
    if (dateTo) params['dateTo'] = dateTo;
    return firstValueFrom(this.http.get(`${this.base}/report/export`, { params, responseType: 'blob' }));
  }
}
