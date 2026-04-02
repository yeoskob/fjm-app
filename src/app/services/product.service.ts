import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductCreate, ProductSubmission, ProductUpdate } from '../models/product';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly apiBase = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  async getAll(): Promise<ProductSubmission[]> {
    return firstValueFrom(this.http.get<ProductSubmission[]>(`${this.apiBase}/products`));
  }

  async addProduct(payload: ProductCreate): Promise<ProductSubmission> {
    return firstValueFrom(this.http.post<ProductSubmission>(`${this.apiBase}/products`, payload));
  }

  async approveProduct(id: string, approvedPrice?: number, approvedSourceId?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/products/${id}/approve`, { approvedPrice, approvedSourceId })
    );
  }

  async updateProduct(id: string, payload: ProductUpdate): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/products/${id}`, payload));
  }
}
