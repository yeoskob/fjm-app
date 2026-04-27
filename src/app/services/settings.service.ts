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

  async downloadBackup(): Promise<string> {
    const response = await firstValueFrom(this.http.get(`${this.base}/backup`, {
      observe: 'response',
      responseType: 'blob',
    }));
    const blob = response.body ?? new Blob();
    const disposition = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = match?.[1] ?? `fjm-db-backup-${new Date().toISOString().slice(0, 10)}.db`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return filename;
  }
}
