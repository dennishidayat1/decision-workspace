import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout/app-layout').then(
        (m) => m.AppLayout,
      ),

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
        loadComponent: () =>
          import(
            './features/decisions/pages/option-detail-page/option-detail-page'
          ).then((m) => m.OptionDetailPage),
      },
    ],
  },
];