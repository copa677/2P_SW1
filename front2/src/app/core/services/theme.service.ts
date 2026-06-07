import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly _theme = signal<'light' | 'dark'>('light');

  readonly theme = this._theme.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as 'light' | 'dark';
      if (saved) {
        this._theme.set(saved);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this._theme.set('dark');
      }
      this.applyTheme();
    }
  }

  toggleTheme() {
    this._theme.update(t => (t === 'light' ? 'dark' : 'light'));
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', this._theme());
      this.applyTheme();
    }
  }

  private applyTheme() {
    if (typeof document !== 'undefined') {
      const isDark = this._theme() === 'dark';
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }
}
