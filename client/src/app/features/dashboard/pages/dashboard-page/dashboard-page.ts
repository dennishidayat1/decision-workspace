import { Component, inject, signal, OnInit } from '@angular/core';
import { DecisionApi } from '../../../decisions/services/decision-api';
import { Decision } from '../../../decisions/models/decision';
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-dashboard-page',
  styleUrl: './dashboard-page.scss',
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {

  ngOnInit(): void {
    this.loadDecisions();
  }

  private readonly decisionApi = inject(DecisionApi);

  readonly decisions = signal<Decision[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  private loadDecisions(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.decisionApi.getAllDecisions().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (decisions) => {
        this.decisions.set(decisions);
      },
      error: (error) => {
        this.loadError.set('Failed to load decisions. Please try again later.');
        console.error('Failed to load decisions:', error);
      },
    });
  }
}
