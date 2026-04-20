import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { NotificationItem, NotificationType, RfqNotificationService } from './services/rfq-notification.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private notifSub?: Subscription;
  notifOpen = false;
  toastVisible = true;
  private lastNotifCount = 0;

  constructor(
    public authService: AuthService,
    public rfqNotif: RfqNotificationService,
    public toast: ToastService,
    private router: Router,
  ) {}

  toggleNotif(): void {
    this.notifOpen = !this.notifOpen;
  }

  closeNotif(): void {
    this.notifOpen = false;
  }

  closeToast(): void {
    this.toastVisible = false;
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.authService.isLoggedIn()) {
          void this.rfqNotif.start();
        } else {
          this.rfqNotif.stop();
        }
      });

    if (this.authService.isLoggedIn()) {
      void this.rfqNotif.start();
    }

    this.notifSub = this.rfqNotif.visible$.subscribe(notifs => {
      document.title = notifs.length > 0 ? `(${notifs.length}) FJM Portal` : 'FJM Portal';
      if (notifs.length > this.lastNotifCount) this.toastVisible = true;
      this.lastNotifCount = notifs.length;
    });
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
  }

  logout(): void {
    this.rfqNotif.stop();
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  routeForType(type: NotificationType): string {
    switch (type) {
      case 'price_approval':
      case 'price_review':
        return '/pricelist';
      case 'price_approved':
        return '/marketing';
      case 'return_to_sourcing':
        return '/sourcing';
      default:
        return this.authService.getLandingRoute();
    }
  }

  private menuForRoute(route: string): string | null {
    switch (route) {
      case '/marketing':
        return 'marketing';
      case '/sourcing':
        return 'sourcing';
      case '/pricelist':
        return 'pricelist';
      case '/dashboard':
        return 'dashboard';
      case '/report':
        return 'report';
      case '/admin/users':
        return 'admin';
      default:
        return null;
    }
  }

  private resolveNotificationRoute(type: NotificationType): string {
    const preferredRoute = this.routeForType(type);
    const menu = this.menuForRoute(preferredRoute);
    if (!menu || this.authService.hasMenu(menu)) {
      return preferredRoute;
    }
    return this.authService.getLandingRoute();
  }

  reviewFirst(notifs: NotificationItem[] | null): void {
    const first = notifs?.[0];
    if (!first) return;
    this.goToReview(first);
  }

  goToReview(n: NotificationItem): void {
    void this.rfqNotif.dismissAll();
    this.notifOpen = false;
    this.toastVisible = false;
    const target = this.resolveNotificationRoute(n.type);
    void this.router.navigate([target], { queryParams: { refresh: Date.now() } });
  }

  dismissAll(): void {
    void this.rfqNotif.dismissAll();
    this.notifOpen = false;
  }
}
