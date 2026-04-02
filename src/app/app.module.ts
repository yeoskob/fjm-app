import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HTTP_INTERCEPTORS, HttpRequest, HttpHandler, HttpInterceptor, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable()
class AuthTokenInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err) => {
        const isAuthEndpoint = req.url.includes('/auth/');
        if (err.status === 401 && this.authService.isLoggedIn() && !isAuthEndpoint) {
          this.authService.logout();
          void this.router.navigateByUrl('/login');
        }
        return throwError(() => err);
      })
    );
  }
}

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AdminUsersComponent } from './admin/admin-users/admin-users.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { MarketingComponent } from './pages/marketing/marketing.component';
import { NotAuthorizedComponent } from './pages/not-authorized/not-authorized.component';
import { PricelistComponent } from './pages/pricelist/pricelist.component';
import { PurchasingComponent } from './pages/purchasing/purchasing.component';
import { SourcingComponent } from './pages/sourcing/sourcing.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    LoginComponent,
    SourcingComponent,
    PurchasingComponent,
    MarketingComponent,
    PricelistComponent,
    NotAuthorizedComponent,
    AdminUsersComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, HttpClientModule],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthTokenInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
