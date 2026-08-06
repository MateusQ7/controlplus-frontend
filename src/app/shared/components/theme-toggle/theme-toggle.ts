import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.css',
})
export class ThemeToggle {

  private readonly themeService = inject(ThemeService);

  protected readonly theme = this.themeService.theme;

  /** O rótulo diz para onde o clique leva, não onde está. */
  protected readonly label = computed(() =>
    this.theme() === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'
  );

  protected toggle(): void {
    this.themeService.toggle();
  }
}
