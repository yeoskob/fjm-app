import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrganizationSetting {
  id: string;
  code: string;
  createdAt: string;
  createdBy?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly base = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getAll(): Promise<Record<string, string>> {
    return firstValueFrom(this.http.get<Record<string, string>>(this.base));
  }

  set(key: string, value: string): Promise<{ key: string; value: string }> {
    return firstValueFrom(this.http.put<{ key: string; value: string }>(`${this.base}/${key}`, { value }));
  }

  getOrganizations(): Promise<OrganizationSetting[]> {
    return firstValueFrom(this.http.get<OrganizationSetting[]>(`${this.base}/organizations`));
  }

  addOrganization(code: string): Promise<OrganizationSetting> {
    return firstValueFrom(this.http.post<OrganizationSetting>(`${this.base}/organizations`, { code }));
  }
}
