import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
import { DecisionApi } from '../../services/decision-api';
import { Decision } from '../../models/decision';
import { finalize } from 'rxjs';
import { DecisionOption } from '../../models/decision-option';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateDecisionOptionRequest } from '../../models/create-decision-option-request';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-decision-detail-page',
  styleUrl: './decision-detail-page.scss',
  templateUrl: './decision-detail-page.html',
})
export class DecisionDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly decisionApi = inject(DecisionApi);

  ngOnInit(): void {
    this.loadDecision();
    this.loadDecisionOptions();
  }

  readonly decisionId = this.route.snapshot.paramMap.get('id');
  readonly decision = signal<Decision | null>(null);
  readonly decisionOptions = signal<DecisionOption[] | []>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly optionSubmitError = signal<string | null>(null);
  readonly optionForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    url: new FormControl('', {
      nonNullable: true,
    }),
    thumbnailUrl: new FormControl('', {
      nonNullable: true,
    }),
    description: new FormControl('', {
      nonNullable: true,
    }),
    price: new FormControl<number | null>(null),
    currency: new FormControl('', {
      nonNullable: true,
    }),
  });

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

  private loadDecisionOptions(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    this.decisionApi.getDecisionOptions(this.decisionId).subscribe({
      next: (options) => {
        this.decisionOptions.set(options);
      },
      error: (error) => {
        console.error('Failed to load decision options:', error);
        this.loadError.set('Failed to load decision options. Please try again later.');
      },
    });
  }

  onAddOption(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    if (this.optionForm.invalid) {
      console.error('Option form is invalid:', this.optionForm.errors);
      this.optionSubmitError.set(
        'Please fill in all required fields for the option.',
      );
      return;
    }

    this.optionSubmitError.set(null);

    const request: CreateDecisionOptionRequest = {
      title: this.optionForm.value.title!,
      description: this.optionForm.value.description || undefined,
      url: this.optionForm.value.url || undefined,
      thumbnailUrl: this.optionForm.value.thumbnailUrl || undefined,
      price: this.optionForm.value.price ?? undefined,
      currency: this.optionForm.value.currency || undefined,
    };

    this.decisionApi.createDecisionOption(this.decisionId, request).subscribe({
      next: (createdOption) => {
        this.decisionOptions.update((options) => [...options, createdOption]);
        this.optionForm.reset();
      },
      error: (error) => {
        console.error('Failed to create decision option:', error);
        this.optionSubmitError.set(
          'Failed to create decision option. Please try again later.',
        );
      },
    });
  }
}
