import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { RfqNotificationService } from './services/rfq-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private notifSub?: Subscription;

  constructor(
    public authService: AuthService,
    public rfqNotif: RfqNotificationService,
    private router: Router,
  ) {}

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

  goToPricelist(): void {
    void this.rfqNotif.dismissAll();
    void this.router.navigateByUrl('/pricelist');
  }
}
