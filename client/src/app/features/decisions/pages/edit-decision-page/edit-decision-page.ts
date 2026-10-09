import {
  Component,
  inject,
  signal,
} from '@angular/core';

import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import {
  createDecisionForm,
  DecisionFormGroup,
} from '../../forms/decision-form';
import { DecisionApi } from '../../services/decision-api';
import { CreateDecisionRequest } from '../../models/create-decision-request';
import { DecisionState } from '../../state/decision-state'

import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonRow,
  IonSpinner,
  IonTextarea,
  NavController,
} from '@ionic/angular';

import { addIcons } from 'ionicons';

import {
  arrowBackOutline,
  checkmarkOutline,
  chevronDownOutline,
} from 'ionicons/icons';

addIcons({
  arrowBackOutline,
  checkmarkOutline,
  chevronDownOutline,
});

@Component({
  selector: 'app-edit-decision-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,

    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonCard,
    IonCardContent,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonRow,
    IonSpinner,
    IonTextarea,
  ],
  templateUrl: './edit-decision-page.html',
  styleUrl: './edit-decision-page.scss',
})
export class EditDecisionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly decisionApi = inject(DecisionApi);
  private readonly navController = inject(NavController);
  private readonly decisionState = inject(DecisionState);

  readonly decisionId =
    this.route.snapshot.paramMap.get('id');

  readonly decisionForm: DecisionFormGroup =
    createDecisionForm();

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);

  readonly loadError =
    signal<string | null>(null);

  readonly submitError =
    signal<string | null>(null);

  readonly showDetails = signal(true);

  ionViewWillEnter(): void {
    this.loadDecision();
  }

  private loadDecision(): void {
    this.loadError.set(null);

    if (!this.decisionId) {
      this.loadError.set(
        'Decision ID is missing.',
      );

      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.decisionApi
      .getDecisionById(this.decisionId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (decision) => {
          this.decisionForm.patchValue({
            question:
              decision.question ||
              decision.title,

            category:
              decision.category ?? '',

            context:
              decision.context ?? '',
          });

          this.decisionForm.markAsPristine();
          this.decisionForm.markAsUntouched();
        },

        error: (error) => {
          console.error(
            'Failed to load decision:',
            error,
          );

          this.loadError.set(
            error.status === 404
              ? 'Decision not found.'
              : 'Failed to load decision. Please try again later.',
          );
        },
      });
  }

  onSubmit(): void {
    if (
      !this.decisionId ||
      this.decisionForm.invalid
    ) {
      this.decisionForm.markAllAsTouched();
      return;
    }

    const formValue =
      this.decisionForm.getRawValue();

    const question =
      formValue.question.trim();

    const decisionDraft: CreateDecisionRequest = {
      title: question,
      question,
      category:
        formValue.category.trim() || undefined,
      context:
        formValue.context.trim() || undefined,
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.decisionApi
      .updateDecision(
        this.decisionId,
        decisionDraft,
      )
      .subscribe({
        next: () => {
          this.decisionState.invalidateDecision(
            this.decisionId!,
          );

          this.navController.navigateBack(
            `/decisions/${this.decisionId}`,
          );
        },

        error: (error) => {
          console.error(
            'Failed to update decision:',
            error,
          );

          this.submitError.set(
            'Failed to save changes. Please try again.',
          );

          this.isSubmitting.set(false);
        },
      });
  }

  cancel(): void {
    if (this.decisionId) {
      this.navController.navigateBack(
        `/decisions/${this.decisionId}`,
      );

      return;
    }

    this.navController.navigateBack(
      '/decisions',
    );
  }
}