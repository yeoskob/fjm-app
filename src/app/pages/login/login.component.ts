import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  error = '';
  isSubmitting = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      void this.router.navigateByUrl(this.authService.getLandingRoute());
    }
  }

  fillDemo(username: string, password: string): void {
    this.username = username;
    this.password = password;
  }

  async submit(): Promise<void> {
    if (this.isSubmitting) {
      return;
    }
    this.error = '';
    this.isSubmitting = true;
    const result = await this.authService.login(this.username, this.password);
    this.isSubmitting = false;

    if (!result.ok) {
      this.error = result.error;
      return;
    }
    void this.router.navigateByUrl(this.authService.getLandingRoute());
  }
}
