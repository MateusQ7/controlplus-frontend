import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/login/login').then((m) => m.Login)
    },
    {
        // Tudo que exige sessão vive dentro da casca: uma sidebar só, um guard só.
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
        children: [
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./features/dashboard/dashboard').then((m) => m.Dashboard)
            },
            {
                path: 'lancamentos',
                loadComponent: () =>
                    import('./features/transactions/transactions').then((m) => m.Transactions)
            },
            {
                path: 'orcamentos',
                loadComponent: () =>
                    import('./features/budgets/budgets').then((m) => m.Budgets)
            },
            {
                path: 'investimentos',
                loadComponent: () =>
                    import('./features/investments/investments').then((m) => m.Investments)
            },
            {
                path: 'categorias',
                loadComponent: () =>
                    import('./features/categories/categories').then((m) => m.Categories)
            },
            {
                path: 'usuarios',
                canActivate: [adminGuard],
                loadComponent: () =>
                    import('./features/users/users').then((m) => m.Users)
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'dashboard'
            }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
