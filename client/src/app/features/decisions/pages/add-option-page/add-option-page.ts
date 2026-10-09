import { Component, signal, inject, effect } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DecisionApi } from '../../services/decision-api';
import { CreateDecisionOptionRequest } from '../../models/create-decision-option-request';
import { OptionInfoForm } from '../../components/option-info-form/option-info-form';
import { AttributeForm } from '../../components/attribute-form/attribute-form';
import { ScoreForm } from '../../components/score-form/score-form';
import { DecisionState } from '../../state/decision-state';
import { ScoreFormGroup, createOptionForm } from '../../forms/option-form';
import {
  NavController,
  IonContent,
  IonBadge,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonNote,
  IonIcon
} from '@ionic/angular';
import { arrowBackOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

addIcons({
  arrowBackOutline,
});

@Component({
  imports: [
    OptionInfoForm,
    AttributeForm,
    ScoreForm,
    ReactiveFormsModule,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonText,
    IonNote,
    IonBadge,
  ],
  selector: 'app-add-option-page',
  styleUrl: './add-option-page.scss',
  templateUrl: './add-option-page.html',
})
export class AddOptionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly decisionApi = inject(DecisionApi);
  private readonly decisionState = inject(DecisionState);
  private readonly navController = inject(NavController);

  readonly decisionId = this.route.snapshot.paramMap.get('id');

  readonly isOptionFormOpen = signal(false);
  readonly optionSubmitError = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly availableAttributeNames = this.decisionState.availableAttributeNames;
  readonly criteria = this.decisionState.criteria;

  readonly optionForm = createOptionForm();

  ionViewWillEnter(): void {
    if (!this.decisionId) {
      return;
    }

    this.decisionState.ensureDecisionLoaded(this.decisionId);
  }

  private readonly populateScores = effect(() => {
    const criteria = this.criteria();
    const scoreArray =
      this.optionForm.controls.scores;

    const existingCriterionIds =
      new Set(
        scoreArray.controls.map(
          score =>
            score.controls.criterionId.value,
        ),
      );

    for (const criterion of criteria) {
      if (
        existingCriterionIds.has(
          criterion.id,
        )
      ) {
        continue;
      }

      scoreArray.push(
        new FormGroup({
          criterionId: new FormControl(
            criterion.id,
            {
              nonNullable: true,
            },
          ),

          score:
            new FormControl<number | null>(
              null,
            ),

          comment: new FormControl(
            '',
            {
              nonNullable: true,
            },
          ),
        }) as ScoreFormGroup,
      );
    }
  });

  onAddOption(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    if (this.optionForm.invalid) {
      this.optionForm.markAllAsTouched();

      this.optionSubmitError.set(
        'Please fill in all required fields for the option.',
      );

      return;
    }

    this.optionSubmitError.set(null);

    const attributesToSave = this.optionForm.controls.attributes.controls
      .map((attribute) => attribute.getRawValue())
      .filter(
        (attribute) =>
          attribute.name.trim() !== '' &&
          attribute.value.trim() !== '',
      );

    const scoresToSave = this.optionForm.controls.scores.controls
      .map((score) => score.getRawValue())
      .filter((score) => score.score !== null)
      .map((score) => ({
        criterionId: score.criterionId,
        score: score.score!,
        comment: score.comment.trim() || undefined,
      }));

    const request: CreateDecisionOptionRequest = {
      title: this.optionForm.value.title!,
      description: this.optionForm.value.description || undefined,
      url: this.optionForm.value.url || undefined,
      thumbnailUrl: this.optionForm.value.thumbnailUrl || undefined,
      price: this.optionForm.value.price ?? undefined,
      currency: this.optionForm.value.currency || undefined,
      attributes: attributesToSave,
      scores: scoresToSave,
    };

    this.decisionApi
      .createDecisionOption(this.decisionId, request)
      .subscribe({
        next: () => {
          this.decisionState.invalidateDecision(this.decisionId!);
          this.navController.navigateBack(['/decisions', this.decisionId]);
        },
        error: (error) => {
          console.error('Failed to create decision option:', error);
          this.optionSubmitError.set(
            'Failed to create decision option. Please try again later.',
          );
        },
      });
  }

  onCancel(): void {
    if (!this.decisionId) {
      return;
    }

    this.navController.navigateBack(['/decisions', this.decisionId]);
  }
}
