import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private items: Toast[] = [];
  readonly toasts$ = new BehaviorSubject<Toast[]>([]);

  error(message: string, durationMs = 5000): void {
    this.show('error', message, durationMs);
  }

  success(message: string, durationMs = 3000): void {
    this.show('success', message, durationMs);
  }

  info(message: string, durationMs = 3000): void {
    this.show('info', message, durationMs);
  }

  dismiss(id: number): void {
    this.items = this.items.filter(t => t.id !== id);
    this.toasts$.next([...this.items]);
  }

  private show(kind: ToastKind, message: string, durationMs: number): void {
    const id = ++this.counter;
    this.items = [...this.items, { id, kind, message }];
    this.toasts$.next([...this.items]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }
}
