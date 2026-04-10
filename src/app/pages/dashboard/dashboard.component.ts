import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InquiryService } from '../../services/inquiry.service';
import { DashboardStats, UserStats } from '../../models/inquiry';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  dashboard: DashboardStats | null = null;
  isAdmin = false;
  activeTab: 'sales' | 'sourcing' = 'sales';

  // User search
  users: Array<{ id: string; name: string; username: string; role: string }> = [];
  searchQuery = '';
  roleFilter = '';
  selectedUser: { id: string; name: string; username: string; role: string } | null = null;
  userStats: UserStats | null = null;
  loadingUser = false;

  get filteredUsers() {
    const q = this.searchQuery.toLowerCase();
    return this.users.filter(
      (u) =>
        (this.roleFilter === '' || u.role === this.roleFilter) &&
        (u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    );
  }

  constructor(private inquiryService: InquiryService, private authService: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('admin');
    void this.load();
    if (this.isAdmin) void this.loadUsers();
  }

  async load(): Promise<void> {
    this.dashboard = await this.inquiryService.getDashboard();
  }

  async loadUsers(): Promise<void> {
    this.users = await this.inquiryService.getUsers();
  }

  async selectUser(user: (typeof this.users)[0]): Promise<void> {
    this.selectedUser = user;
    this.userStats = null;
    this.loadingUser = true;
    this.userStats = await this.inquiryService.getUserStats(user.name);
    this.loadingUser = false;
  }

  clearUser(): void {
    this.selectedUser = null;
    this.userStats = null;
    this.searchQuery = '';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      new_inquiry: 'New Inquiry',
      rfq: 'RFQ to Sourcing',
      price_approval: 'Price Approval',
      quotation_sent: 'Quotation Sent',
      follow_up: 'Negotiation',
      deal: 'Deal',
      lost: 'Lost',
    };
    return map[status] ?? status;
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      marketing: 'Sales / Marketing',
      sourcing: 'Sourcing',
    };
    return map[role] ?? role;
  }
}
