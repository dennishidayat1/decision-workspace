import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateDecisionRequest } from '../../models/create-decision-request';
import { DecisionApi } from '../../services/decision-api';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/internal/operators/finalize';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-create-decision-page',
  styleUrl: './create-decision-page.scss',
  templateUrl: './create-decision-page.html',
})
export class CreateDecisionPage {
  private readonly decisionApi = inject(DecisionApi);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly decisionForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    question: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    context: new FormControl('', {
      nonNullable: true,
    }),
    category: new FormControl('', {
      nonNullable: true,
    }),
  });

  onSubmit(): void {
    if (this.decisionForm.invalid || this.isSubmitting()) {
      return;
    }

    this.submitError.set(null);
    this.isSubmitting.set(true);

    const request: CreateDecisionRequest = this.decisionForm.getRawValue();

    this.decisionApi.createDecision(request).pipe(
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (decision) => {
        console.log('Decision created:', decision);
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Failed to create decision:', error);
        this.submitError.set('Failed to create decision. Please try again later.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
