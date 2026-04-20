import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminUsersComponent } from './admin/admin-users/admin-users.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { LoginComponent } from './pages/login/login.component';
import { MarketingComponent } from './pages/marketing/marketing.component';
import { NotAuthorizedComponent } from './pages/not-authorized/not-authorized.component';
import { PricelistComponent } from './pages/pricelist/pricelist.component';
import { PurchasingComponent } from './pages/purchasing/purchasing.component';
import { SourcingComponent } from './pages/sourcing/sourcing.component';
import { ReportComponent } from './pages/report/report.component';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'sourcing',
    component: SourcingComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'sourcing' },
  },
  {
    path: 'purchasing',
    component: PurchasingComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'purchasing' },
  },
  {
    path: 'marketing',
    component: MarketingComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'marketing' },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'dashboard' },
  },
  {
    path: 'pricelist',
    component: PricelistComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'pricelist' },
  },
  {
    path: 'admin/users',
    component: AdminUsersComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'admin' },
  },
  {
    path: 'report',
    component: ReportComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { menu: 'report' },
  },
  { path: 'not-authorized', component: NotAuthorizedComponent },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
