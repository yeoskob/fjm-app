import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
}
