import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { pendingChangesGuard } from './core/auth/pending-changes.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import(
        './features/auth/pages/auth-page/auth-page'
      ).then(m => m.AuthPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password')
        .then(m => m.ResetPassword),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout/app-layout').then(
        (m) => m.AppLayout,
      ),

    canActivate: [authGuard],

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'decisions',
      },
      {
        path: 'decisions',
        loadComponent: () =>
          import(
            './features/decisions/pages/decisions-page/decisions-page'
          ).then((m) => m.DecisionsPage),
      },
      {
        path: 'decisions/new',
        loadComponent: () =>
          import(
            './features/decisions/pages/create-decision-page/create-decision-page'
          ).then((m) => m.CreateDecisionPage),
      },
      {
        path: 'decisions/:id',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import(
            './features/decisions/pages/decision-detail-page/decision-detail-page'
          ).then((m) => m.DecisionDetailPage),
      },
      {
        path: 'decisions/:id/options/new',
        loadComponent: () =>
          import(
            './features/decisions/pages/add-option-page/add-option-page'
          ).then((m) => m.AddOptionPage),
      },
      {
        path: 'decisions/:id/options/:optionId',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import(
            './features/decisions/pages/option-detail-page/option-detail-page'
          ).then((m) => m.OptionDetailPage),
      },

      {
        path: 'decisions/:id/edit',
        loadComponent: () =>
          import(
            './features/decisions/pages/edit-decision-page/edit-decision-page'
          ).then(m => m.EditDecisionPage),
      },

      {
        path: 'decisions/:id/criteria',
        loadComponent: () =>
          import(
            './features/decisions/pages/edit-criteria-page/edit-criteria-page'
          ).then(m => m.EditCriteriaPage),
      },
      {
        path: 'decisions/:id/compare',
        loadComponent: () =>
          import(
            './features/decisions/pages/compare-options/compare-options'
          ).then(m => m.CompareOptions),
      },
    ],
  },
];
