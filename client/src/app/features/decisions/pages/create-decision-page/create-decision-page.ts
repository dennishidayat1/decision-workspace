import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateDecisionRequest } from '../../models/create-decision-request';
import { DecisionApi } from '../../services/decision-api';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-create-decision-page',
  styleUrl: './create-decision-page.scss',
  templateUrl: './create-decision-page.html',
})
export class CreateDecisionPage {
  private readonly decisionApi = inject(DecisionApi);
  
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
    if (this.decisionForm.invalid) {
      return;
    }

    const request: CreateDecisionRequest = this.decisionForm.getRawValue();

    this.decisionApi.createDecision(request).subscribe({
      next: (decision) => {
        console.log('Decision created:', decision);
      },
      error: (error) => {
        console.error('Failed to create decision:', error);
      },
    });
  }
}
