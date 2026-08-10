import { effect, Injectable, signal } from "@angular/core";

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'controlplus:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {

    private readonly current = signal<Theme>(readInitialTheme());

    readonly theme = this.current.asReadonly();

    constructor() {
        effect(() => {
            const theme = this.current();
            document.documentElement.dataset['theme'] = theme;

            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch {
                // Janela anônima ou armazenamento bloqueado: o tema vale só nesta aba.
            }
        });
    }

    toggle(): void {
        this.current.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
    }

    set(theme: Theme): void {
        this.current.set(theme);
    }
}

/**
 * Escolha salva vence; sem ela, segue o sistema operacional. O index.html roda
 * a mesma lógica antes da primeira pintura para não piscar o tema errado.
 */
function readInitialTheme(): Theme {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
    } catch {
        // Sem acesso ao armazenamento: cai na preferência do sistema.
    }

    // matchMedia não existe em jsdom nem em pré-renderização no servidor.
    if (typeof matchMedia !== 'function') {
        return 'dark';
    }

    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
