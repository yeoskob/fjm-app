import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Role, User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { RoleService, RoleDef } from '../../services/role.service';
import { OrganizationSetting, SettingsService } from '../../services/settings.service';

export const PRICE_REVIEW_DEADLINE_HOURS_KEY = 'price_review_deadline_hours';

export const ALL_MODULES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'pricelist', label: 'Price List' },
  { key: 'report', label: 'Report' },
];

type AdminTab = 'users' | 'roles' | 'organizations' | 'deadline';
type ReportAccessTab = 'marketing' | 'sourcing' | 'purchasing';

const REPORT_ACCESS_TABS: Array<{ key: ReportAccessTab; label: string }> = [
  { key: 'marketing', label: 'Marketing Tab' },
  { key: 'sourcing', label: 'Sourcing Tab' },
  { key: 'purchasing', label: 'Purchasing Tab' },
];

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

  roleForm: { name: string; menus: Record<string, boolean>; tabs: { report: Record<ReportAccessTab, boolean> } } = {
    name: '',
    menus: {},
    tabs: { report: { marketing: false, sourcing: false, purchasing: false } },
  };

  // Organizations
  organizations: OrganizationSetting[] = [];
  orgCode = '';
  orgError = '';
  orgSuccess = '';
  orgBusy = false;

  readonly modules = ALL_MODULES;
  readonly reportTabs = REPORT_ACCESS_TABS;

  deadlineHours = 24;
  deadlineBusy = false;
  deadlineError = '';
  deadlineSuccess = '';

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
    const [users, roles, organizations, settings] = await Promise.all([
      this.userService.getUsers(),
      this.roleService.getAll(),
      this.settingsService.getOrganizations(),
      this.settingsService.getAll(),
    ]);
    this.users = users;
    this.roles = roles;
    this.organizations = organizations;

    if (!this.userForm.role && this.roles.length > 0) {
      this.userForm.role = this.roles[0].name;
    }

    const rawDeadline = settings[PRICE_REVIEW_DEADLINE_HOURS_KEY];
    this.deadlineHours = rawDeadline ? Number(rawDeadline) : 24;
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
    this.roleForm = this.createEmptyRoleForm();
    this.roleError = '';
    this.roleSuccess = '';
  }

  startEditRole(role: RoleDef): void {
    this.editingRoleName = role.name;
    this.isAddingRole = false;
    const menus: Record<string, boolean> = {};
    for (const m of this.modules) menus[m.key] = role.menus.includes(m.key);
    const tabs = this.createEmptyRoleForm().tabs;
    const reportTabs = role.tabs?.['report'] ?? [];
    for (const t of this.reportTabs) tabs.report[t.key] = reportTabs.includes(t.key);
    this.roleForm = { name: role.name, menus, tabs };
    this.roleError = '';
    this.roleSuccess = '';
  }

  cancelRoleEdit(): void {
    this.editingRoleName = null;
    this.isAddingRole = false;
    this.roleForm = this.createEmptyRoleForm();
    this.roleError = '';
    this.roleSuccess = '';
  }

  selectedMenus(): string[] {
    return this.modules.filter((m) => this.roleForm.menus[m.key]).map((m) => m.key);
  }

  selectedTabs(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    if (this.roleForm.menus['report']) {
      const reportTabs = this.reportTabs.filter((t) => this.roleForm.tabs.report[t.key]).map((t) => t.key);
      result['report'] = reportTabs;
    }
    return result;
  }

  async saveRole(): Promise<void> {
    if (this.roleBusy) return;
    this.roleError = '';
    this.roleSuccess = '';
    const menus = this.selectedMenus();
    const tabs = this.selectedTabs();
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
        await this.roleService.create(name, menus, tabs);
        this.roleSuccess = `Role "${name}" created.`;
      } else if (this.editingRoleName) {
        await this.roleService.update(this.editingRoleName, menus, tabs);
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

  roleTabLabels(role: RoleDef): string {
    const reportTabs = role.tabs?.['report'] ?? [];
    if (!reportTabs.length) return '';
    const labels = this.reportTabs
      .filter((tab) => reportTabs.includes(tab.key))
      .map((tab) => tab.label.replace(' Tab', ''));
    return labels.length ? `Report Tabs: ${labels.join(', ')}` : '';
  }

  onRoleMenuToggle(menuKey: string): void {
    if (menuKey !== 'report') return;
    if (!this.roleForm.menus['report']) {
      for (const t of this.reportTabs) this.roleForm.tabs.report[t.key] = false;
    }
  }

  private createEmptyRoleForm(): { name: string; menus: Record<string, boolean>; tabs: { report: Record<ReportAccessTab, boolean> } } {
    return {
      name: '',
      menus: {},
      tabs: { report: { marketing: false, sourcing: false, purchasing: false } },
    };
  }

  async saveDeadlineHours(): Promise<void> {
    if (this.deadlineBusy) return;
    this.deadlineError = '';
    this.deadlineSuccess = '';
    const hours = Number(this.deadlineHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      this.deadlineError = 'Enter a positive number of hours.';
      return;
    }
    this.deadlineBusy = true;
    try {
      await this.settingsService.set(PRICE_REVIEW_DEADLINE_HOURS_KEY, String(hours));
      this.deadlineSuccess = 'Deadline saved.';
    } catch (err: any) {
      this.deadlineError = err?.error?.error ?? 'Failed to save.';
    } finally {
      this.deadlineBusy = false;
    }
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

