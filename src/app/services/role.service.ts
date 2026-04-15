import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RoleDef {
  name: string;
  menus: string[];
  tabs?: Record<string, string[]>;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly base = `${environment.apiUrl}/roles`;

  constructor(private http: HttpClient) {}

  getAll(): Promise<RoleDef[]> {
    return firstValueFrom(this.http.get<RoleDef[]>(this.base));
  }

  create(name: string, menus: string[]): Promise<RoleDef> {
    return firstValueFrom(this.http.post<RoleDef>(this.base, { name, menus }));
  }

  update(name: string, menus: string[]): Promise<RoleDef> {
    return firstValueFrom(this.http.put<RoleDef>(`${this.base}/${encodeURIComponent(name)}`, { menus }));
  }

  delete(name: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${encodeURIComponent(name)}`));
  }
}
