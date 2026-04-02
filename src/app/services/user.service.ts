import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User, UserCreate } from '../models/user';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiBase = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  async getUsers(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>(`${this.apiBase}/users`));
  }

  async addUser(input: UserCreate): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
    try {
      const user = await firstValueFrom(this.http.post<User>(`${this.apiBase}/users`, input));
      return { ok: true, user };
    } catch (error: any) {
      const message = error?.error?.error ?? 'Failed to add user.';
      return { ok: false, error: message };
    }
  }

  async updateUser(updated: User): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
    try {
      const user = await firstValueFrom(this.http.put<User>(`${this.apiBase}/users/${updated.id}`, updated));
      return { ok: true, user };
    } catch (error: any) {
      const message = error?.error?.error ?? 'Failed to update user.';
      return { ok: false, error: message };
    }
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/users/${id}`));
  }
}
