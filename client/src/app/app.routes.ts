import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout/app-layout').then((m) => m.AppLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
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
    ],
  },
];