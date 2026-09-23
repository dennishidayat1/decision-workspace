import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
import { DecisionApi } from '../../services/decision-api';
import { Decision } from '../../models/decision';
import { finalize } from 'rxjs';

@Component({
  imports: [],
  selector: 'app-decision-detail-page',
  styleUrl: './decision-detail-page.scss',
  templateUrl: './decision-detail-page.html',
})
export class DecisionDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly decisionApi = inject(DecisionApi);

  ngOnInit(): void {
    this.loadDecision();
  }

  readonly decisionId = this.route.snapshot.paramMap.get('id');
  readonly decision = signal<Decision | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  private loadDecision(): void {
    this.loadError.set(null);

    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      this.isLoading.set(false);
      return;
    }

    this.decisionApi
    .getDecisionById(this.decisionId).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (decision) => {
        this.decision.set(decision);
      },
      error: (error) => {
        console.error('Failed to load decision:', error);

        if (error.status === 404) {
          this.loadError.set('Decision not found.');
        } else {
          this.loadError.set('Failed to load decision. Please try again later.');
        }
      },
    });
  }
}
