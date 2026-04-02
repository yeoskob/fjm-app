import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.authService.isLoggedIn()) {
      return this.router.createUrlTree(['/login']);
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      return this.router.createUrlTree(['/login']);
    }

    // Admin always has access
    if (user.role === 'admin') {
      return true;
    }

    // Check menu key from route data (preferred)
    const menu = route.data['menu'] as string | undefined;
    if (menu && user.menus?.includes(menu)) {
      return true;
    }

    // Fallback: check legacy roles array
    const roles = (route.data['roles'] as string[] | undefined) ?? [];
    if (roles.length === 0) {
      return true;
    }
    if (roles.includes(user.role)) {
      return true;
    }

    return this.router.createUrlTree(['/not-authorized']);
  }
}
