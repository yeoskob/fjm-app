import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Role, User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit {
  users: User[] = [];
  editingId: string | null = null;
  error = '';
  success = '';
  settingsSuccess = '';
  marginPct = 20;
  isBusy = false;

  form: {
    name: string;
    username: string;
    password: string;
    role: Role;
  } = {
    name: '',
    username: '',
    password: '',
    role: 'sourcing',
  };

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.refresh();
    void this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    const s = await this.settingsService.getAll();
    this.marginPct = s['default_margin_pct'] ? Number(s['default_margin_pct']) : 20;
  }

  async saveMargin(): Promise<void> {
    await this.settingsService.set('default_margin_pct', String(this.marginPct));
    this.settingsSuccess = `Default margin disimpan: ${this.marginPct}%`;
    setTimeout(() => { this.settingsSuccess = ''; }, 3000);
  }

  async refresh(): Promise<void> {
    this.users = await this.userService.getUsers();
  }

  startEdit(user: User): void {
    this.editingId = user.id;
    this.form = {
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
    };
    this.error = '';
    this.success = '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form = {
      name: '',
      username: '',
      password: '',
      role: 'sourcing',
    };
  }

  async save(): Promise<void> {
    if (this.isBusy) {
      return;
    }

    this.error = '';
    this.success = '';

    const name = this.form.name.trim();
    const username = this.form.username.trim();

    if (!name || !username) {
      this.error = 'Name and username are required.';
      return;
    }

    if (!this.editingId && !this.form.password.trim()) {
      this.error = 'Password is required for new users.';
      return;
    }

    this.isBusy = true;

    if (this.editingId) {
      const existing = this.users.find((user) => user.id === this.editingId);
      if (!existing) {
        this.error = 'User not found.';
        this.isBusy = false;
        return;
      }
      const password = this.form.password.trim() ? this.form.password : undefined;
      const result = await this.userService.updateUser({
        ...existing,
        name,
        username,
        password,
        role: this.form.role,
      });
      if (!result.ok) {
        this.error = result.error;
        this.isBusy = false;
        return;
      }
      this.authService.updateCurrentUser(result.user);
      this.success = 'User updated.';
    } else {
      const result = await this.userService.addUser({
        name,
        username,
        password: this.form.password,
        role: this.form.role,
      });
      if (!result.ok) {
        this.error = result.error;
        this.isBusy = false;
        return;
      }
      this.success = 'User added.';
    }

    await this.refresh();
    this.cancelEdit();
    this.isBusy = false;
  }

  async delete(user: User): Promise<void> {
    if (!confirm(`Delete user ${user.username}?`)) {
      return;
    }

    await this.userService.deleteUser(user.id);

    if (this.authService.getCurrentUser()?.id === user.id) {
      this.authService.logout();
      void this.router.navigateByUrl('/login');
      return;
    }

    await this.refresh();
  }
}
