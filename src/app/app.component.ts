import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { RfqNotificationService } from './services/rfq-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public rfqNotif: RfqNotificationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Start/stop polling whenever the route changes so it kicks in right after login
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
