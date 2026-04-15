import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Role, User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { RoleService, RoleDef } from '../../services/role.service';
import { OrganizationSetting, SettingsService } from '../../services/settings.service';

export const ALL_MODULES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'pricelist', label: 'Price List' },
  { key: 'purchasing', label: 'Purchasing' },
];

type AdminTab = 'users' | 'roles' | 'organizations';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit {
  activeTab: AdminTab = 'users';
  isAdmin = false;

  // Users
  users: User[] = [];
  roles: RoleDef[] = [];
  editingUserId: string | null = null;
  userError = '';
  userSuccess = '';
  isBusy = false;

  userForm: { name: string; username: string; password: string; role: string } = {
    name: '',
    username: '',
    password: '',
    role: '',
  };

  // Roles
  editingRoleName: string | null = null;
  isAddingRole = false;
  roleError = '';
  roleSuccess = '';
  roleBusy = false;

  roleForm: { name: string; menus: Record<string, boolean> } = {
    name: '',
    menus: {},
  };

  // Organizations
  organizations: OrganizationSetting[] = [];
  orgCode = '';
  orgError = '';
  orgSuccess = '';
  orgBusy = false;

  readonly modules = ALL_MODULES;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private roleService: RoleService,
    private settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('admin');
    void this.refresh();
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
    this.cancelUserEdit();
    this.cancelRoleEdit();
    this.orgError = '';
    this.orgSuccess = '';
  }

  async refresh(): Promise<void> {
    [this.users, this.roles, this.organizations] = await Promise.all([
      this.userService.getUsers(),
      this.roleService.getAll(),
      this.settingsService.getOrganizations(),
    ]);
    if (!this.userForm.role && this.roles.length > 0) {
      this.userForm.role = this.roles[0].name;
    }
  }

  // User methods
  startEditUser(user: User): void {
    this.editingUserId = user.id;
    this.userForm = { name: user.name, username: user.username, password: '', role: user.role };
    this.userError = '';
    this.userSuccess = '';
  }

  cancelUserEdit(): void {
    this.editingUserId = null;
    this.userForm = { name: '', username: '', password: '', role: this.roles[0]?.name ?? '' };
    this.userError = '';
    this.userSuccess = '';
  }

  async saveUser(): Promise<void> {
    if (this.isBusy) return;
    this.userError = '';
    this.userSuccess = '';
    const name = this.userForm.name.trim();
    const username = this.userForm.username.trim();
    if (!name || !username) {
      this.userError = 'Name and username are required.';
      return;
    }
    if (!this.editingUserId && !this.userForm.password.trim()) {
      this.userError = 'Password is required for new users.';
      return;
    }
    this.isBusy = true;

    if (this.editingUserId) {
      const existing = this.users.find((u) => u.id === this.editingUserId);
      if (!existing) {
        this.userError = 'User not found.';
        this.isBusy = false;
        return;
      }
      const password = this.userForm.password.trim() || undefined;
      const result = await this.userService.updateUser({
        ...existing,
        name,
        username,
        password,
        role: this.userForm.role as Role,
      });
      if (!result.ok) {
        this.userError = result.error;
        this.isBusy = false;
        return;
      }
      this.authService.updateCurrentUser(result.user);
      this.userSuccess = 'User updated.';
    } else {
      const result = await this.userService.addUser({
        name,
        username,
        password: this.userForm.password,
        role: this.userForm.role as Role,
      });
      if (!result.ok) {
        this.userError = result.error;
        this.isBusy = false;
        return;
      }
      this.userSuccess = 'User added.';
    }

    await this.refresh();
    this.cancelUserEdit();
    this.isBusy = false;
  }

  async deleteUser(user: User): Promise<void> {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    await this.userService.deleteUser(user.id);
    if (this.authService.getCurrentUser()?.id === user.id) {
      this.authService.logout();
      void this.router.navigateByUrl('/login');
      return;
    }
    await this.refresh();
  }

  // Role methods
  startAddRole(): void {
    this.isAddingRole = true;
    this.editingRoleName = null;
    this.roleForm = { name: '', menus: {} };
    this.roleError = '';
    this.roleSuccess = '';
  }

  startEditRole(role: RoleDef): void {
    this.editingRoleName = role.name;
    this.isAddingRole = false;
    const menus: Record<string, boolean> = {};
    for (const m of this.modules) menus[m.key] = role.menus.includes(m.key);
    this.roleForm = { name: role.name, menus };
    this.roleError = '';
    this.roleSuccess = '';
  }

  cancelRoleEdit(): void {
    this.editingRoleName = null;
    this.isAddingRole = false;
    this.roleForm = { name: '', menus: {} };
    this.roleError = '';
    this.roleSuccess = '';
  }

  selectedMenus(): string[] {
    return this.modules.filter((m) => this.roleForm.menus[m.key]).map((m) => m.key);
  }

  async saveRole(): Promise<void> {
    if (this.roleBusy) return;
    this.roleError = '';
    this.roleSuccess = '';
    const menus = this.selectedMenus();
    if (menus.length === 0) {
      this.roleError = 'Select at least one module.';
      return;
    }

    this.roleBusy = true;
    try {
      if (this.isAddingRole) {
        const name = this.roleForm.name.trim();
        if (!name) {
          this.roleError = 'Role name is required.';
          return;
        }
        await this.roleService.create(name, menus);
        this.roleSuccess = `Role "${name}" created.`;
      } else if (this.editingRoleName) {
        await this.roleService.update(this.editingRoleName, menus);
        this.roleSuccess = `Role "${this.editingRoleName}" updated.`;
      }
      await this.refresh();
      this.cancelRoleEdit();
    } catch (err: any) {
      this.roleError = err?.error?.error ?? 'Failed to save role.';
    } finally {
      this.roleBusy = false;
    }
  }

  async deleteRole(role: RoleDef): Promise<void> {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try {
      await this.roleService.delete(role.name);
      await this.refresh();
    } catch (err: any) {
      this.roleError = err?.error?.error ?? 'Failed to delete role.';
    }
  }

  roleMenuLabels(role: RoleDef): string {
    return role.menus
      .map((k) => this.modules.find((m) => m.key === k)?.label ?? k)
      .join(', ');
  }

  async addOrganization(): Promise<void> {
    if (!this.isAdmin || this.orgBusy) return;
    this.orgError = '';
    this.orgSuccess = '';

    const code = this.orgCode.trim().toUpperCase();
    if (!code) {
      this.orgError = 'Organization code is required.';
      return;
    }

    this.orgBusy = true;
    try {
      await this.settingsService.addOrganization(code);
      this.orgCode = '';
      this.orgSuccess = `Organization "${code}" added.`;
      this.organizations = await this.settingsService.getOrganizations();
    } catch (err: any) {
      this.orgError = err?.error?.error ?? 'Failed to add organization.';
    } finally {
      this.orgBusy = false;
    }
  }
}
