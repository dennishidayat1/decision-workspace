import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonIcon,
  IonNote,
  IonRow,
  IonSpinner,
  IonToolbar,
  NavController,
  ToastController,
} from '@ionic/angular';

import {
  addIcons,
} from 'ionicons';

import {
  addOutline,
  arrowBackOutline,
} from 'ionicons/icons';

import { CreateDecisionWorkspaceRequest } from '../../models/create-decision-workspace-request';
import { DecisionApi } from '../../services/decision-api';
import { createCriterionDraftForm, createDecisionForm } from '../../forms/decision-form';
import { DecisionForm } from '../../components/decision-form/decision-form';
import { CriteriaForm } from '../../components/criteria-form/criteria-form';


addIcons({
  addOutline,
  arrowBackOutline,
});


@Component({
  selector: 'app-create-decision-page',

  imports: [
    ReactiveFormsModule,

    DecisionForm,
    CriteriaForm,

    IonButton,
    IonCard,
    IonCardContent,
    IonCol,
    IonContent,
    IonFooter,
    IonGrid,
    IonIcon,
    IonNote,
    IonRow,
    IonSpinner,
    IonToolbar,
  ],

  templateUrl: './create-decision-page.html',
  styleUrl: './create-decision-page.scss',
})
export class CreateDecisionPage {
  private readonly decisionApi = inject(DecisionApi);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  readonly decisionForm = createDecisionForm();

  readonly showCriteria = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);


  private readonly questionValue =
    toSignal(
      this.decisionForm.controls.question.valueChanges,
      {
        initialValue:
          this.decisionForm.controls.question.value,
      },
    );

  readonly canSubmit =
    computed(() =>
      Boolean(this.questionValue().trim()) &&
      !this.isSubmitting(),
    );

  openCriteria(): void {
    if (
      this.decisionForm.controls.criteria.length === 0
    ) {
      this.decisionForm.controls.criteria.push(
        createCriterionDraftForm(),
      );
    }

    this.showCriteria.set(true);
  }


  hideCriteria(): void {
    this.showCriteria.set(false);
  }

  onSubmit(): void {
    if (
      !this.canSubmit() ||
      this.decisionForm.controls.question.invalid
    ) {
      this.decisionForm.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.isSubmitting.set(true);

    const formValue = this.decisionForm.getRawValue();
    const question = formValue.question.trim();

    const request: CreateDecisionWorkspaceRequest = {
      title: question,
      question,
      category: formValue.category.trim() || undefined,
      context: formValue.context.trim() || undefined,
      criteria:
        formValue.criteria
          .filter(
            criterion => criterion.name.trim(),
          )
          .map(criterion => ({
            name: criterion.name.trim(),
            importance: criterion.importance,
            context: criterion.context.trim() || undefined,
          })),
    };

    this.decisionApi
      .createDecisionWorkspace(request)
      .pipe(
        finalize(() =>
          this.isSubmitting.set(false),
        ),
      )
      .subscribe({
        next: async (decision) => {
          await this.navController.navigateForward(['/decisions', decision.id])
          await this.presentToast('Decision created');
        },

        error: (error) => {
          console.error(
            'Failed to create decision:',
            error,
          );

          this.submitError.set('Failed to create decision. Please try again.');
        },
      });
  }

  goBack(): void {
    this.navController.navigateBack('/decisions');
  }

  private async presentToast(message: string): Promise<void> {
    const toast =
      await this.toastController.create({
        message,
        duration: 2500,
        position: 'bottom',
      });

    await toast.present();
  }
}