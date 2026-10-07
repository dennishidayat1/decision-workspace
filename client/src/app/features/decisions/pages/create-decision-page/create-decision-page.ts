import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  ReactiveFormsModule,
} from '@angular/forms';

import {
  toSignal,
} from '@angular/core/rxjs-interop';

import {
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

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

import { CreateDecisionRequest } from '../../models/create-decision-request';

import { CreateCriterionRequest } from '../../models/create-criterion-request';

import { DecisionApi } from '../../services/decision-api';

import { createCriterionDraftForm , createDecisionForm } from '../../forms/decision-form';

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

    const request: CreateDecisionRequest = {
      title: question,
      question,

      category:
        formValue.category.trim(),

      context:
        formValue.context.trim(),
    };

    const criteriaRequests:
      CreateCriterionRequest[] =
      formValue.criteria
        .filter(
          (criterion) =>
            criterion.name.trim(),
        )
        .map((criterion) => ({
          name:
            criterion.name.trim(),

          importance:
            criterion.importance,

          context:
            criterion.context.trim() ||
            undefined,
        }));

    this.decisionApi
      .createDecision(request)
      .pipe(

        switchMap((decision) => {

          if (!criteriaRequests.length) {
            return of({
              decision,
              criteriaFailed: false,
            });
          }


          return forkJoin(
            criteriaRequests.map(
              (criterion) =>
                this.decisionApi
                  .createCriterion(
                    decision.id,
                    criterion,
                  ),
            ),
          ).pipe(

            map(() => ({
              decision,
              criteriaFailed: false,
            })),

            catchError((error) => {
              console.error(
                'Decision created, but criteria failed:',
                error,
              );

              return of({
                decision,
                criteriaFailed: true,
              });
            }),
          );
        }),

        finalize(() =>
          this.isSubmitting.set(false),
        ),
      )
      .subscribe({

        next: ({
          decision,
          criteriaFailed,
        }) => {

          void this.navController
            .navigateForward([
              '/decisions',
              decision.id,
            ])
            .then(() => {

              void this.presentToast(
                criteriaFailed
                  ? 'Decision created, but some criteria could not be saved.'
                  : 'Decision created',
              );
            });
        },

        error: (error) => {
          console.error(
            'Failed to create decision:',
            error,
          );

          this.submitError.set(
            'Failed to create decision. Please try again.',
          );
        },
      });
  }

  goBack(): void {
    this.navController.navigateBack(
      '/decisions',
    );
  }

  private async presentToast(
    message: string,
  ): Promise<void> {
    const toast =
      await this.toastController.create({
        message,
        duration: 2500,
        position: 'bottom',
      });

    await toast.present();
  }
}