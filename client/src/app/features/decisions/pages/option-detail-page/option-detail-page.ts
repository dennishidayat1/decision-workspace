import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  NavController
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  bagHandleOutline,
  checkmarkOutline,
  closeOutline,
  createOutline,
  openOutline,
  star,
  trashOutline,
} from 'ionicons/icons';

import { DecisionState } from '../../state/decision-state';
import { AttributeFormGroup, ScoreFormGroup, createOptionForm } from '../../forms/option-form';
import { AttributeForm } from '../../components/attribute-form/attribute-form';
import { ScoreForm } from '../../components/score-form/score-form';

addIcons({
  arrowBackOutline,
  bagHandleOutline,
  checkmarkOutline,
  closeOutline,
  createOutline,
  openOutline,
  star,
  trashOutline,
});

@Component({
  selector: 'app-option-detail-page',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,

    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,

    AttributeForm,
    ScoreForm,
  ],
  templateUrl: './option-detail-page.html',
  styleUrl: './option-detail-page.scss',
})
export class OptionDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly decisionState = inject(DecisionState);
  private readonly navController = inject(NavController);

  readonly decisionId = this.route.snapshot.paramMap.get('id') ?? null;
  readonly optionId = this.route.snapshot.paramMap.get('optionId');

  readonly optionForm = createOptionForm();

  readonly editingAttributes = signal(false);
  readonly editingBasic = signal(false);

  readonly showMoreScores = signal(false);
  readonly showMoreAttributes = signal(false);

  // readonly isChosen = signal(false);
  readonly deleting = signal(false);

  readonly option = computed(() => {
    if (!this.optionId) {
      return null;
    }

    return (
      this.decisionState
        .options()
        .find(option => option.id === this.optionId) ??
      null
    );
  });

  readonly attributes = computed(() => {
    if (!this.optionId) {
      return [];
    }

    return (
      this.decisionState.optionAttributes()[
      this.optionId
      ] ?? []
    );
  });

  readonly scores = computed(() => {
    if (!this.optionId) {
      return [];
    }

    return (
      this.decisionState.optionScores()[
      this.optionId
      ] ?? []
    );
  });

  readonly criteria =
    this.decisionState.criteria;

  readonly visibleAttributes = computed(() => {
    const attributes = this.attributes();

    return this.showMoreAttributes()
      ? attributes
      : attributes.slice(0, 5);
  });

  readonly weightedScore = computed(() => {
    const scores = this.scores();

    if (scores.length === 0) {
      return null;
    }

    let weightedTotal = 0;
    let totalImportance = 0;

    for (const optionScore of scores) {
      const criterion = this.criteria().find(
        criterion =>
          criterion.id === optionScore.criterionId,
      );

      if (!criterion) {
        continue;
      }

      weightedTotal +=
        optionScore.score * criterion.importance;

      totalImportance += criterion.importance;
    }

    if (totalImportance === 0) {
      return null;
    }

    return weightedTotal / totalImportance;
  });

  private hydratedOptionId: string | null = null;

  private readonly hydrateForm = effect(() => {
    const option = this.option();
    const loadStatus =
      this.decisionState.loadStatus();

    if (
      !option ||
      loadStatus !== 'loaded' ||
      this.hydratedOptionId === option.id
    ) {
      return;
    }

    this.optionForm.patchValue({
      title: option.title,
      url: option.url ?? '',
      thumbnailUrl: option.thumbnailUrl ?? '',
      description: option.description ?? '',
      price: option.price ?? null,
      currency: option.currency ?? 'IDR',
    });

    const attributeArray =
      this.optionForm.controls.attributes;

    attributeArray.clear();

    for (const attribute of this.attributes()) {
      attributeArray.push(
        new FormGroup({
          name: new FormControl(attribute.name, {
            nonNullable: true,
          }),
          value: new FormControl(attribute.value, {
            nonNullable: true,
          }),
        }) as AttributeFormGroup,
      );
    }

    const scoreArray =
      this.optionForm.controls.scores;

    scoreArray.clear();

    for (const criterion of this.criteria()) {
      const existingScore = this.scores().find(
        score =>
          score.criterionId === criterion.id,
      );

      scoreArray.push(
        new FormGroup({
          criterionId: new FormControl(
            criterion.id,
            {
              nonNullable: true,
            },
          ),

          score: new FormControl<number | null>(
            existingScore?.score ?? null,
          ),

          comment: new FormControl(
            existingScore?.comment ?? '',
            {
              nonNullable: true,
            },
          ),
        }) as ScoreFormGroup,
      );
    }

    this.hydratedOptionId = option.id;
  });

  ionViewWillEnter(): void {
    if (!this.decisionId) {
      return;
    }

    this.decisionState.ensureDecisionLoaded(
      this.decisionId,
    );
  }

  backToDecision(): void {
    if (!this.decisionId) {
      return;
    }

    this.navController.navigateBack(['/decisions',this.decisionId]);
  }

  toggleAttributesEdit(): void {
    this.editingAttributes.update(value => !value);
  }

  toggleBasicEdit(): void {
    this.editingBasic.update(value => !value);
  }

  // toggleChoice(): void {
  //   this.isChosen.update(value => !value);
  // }

  saveAttributes(): void {
    /*
     * UI/state is ready.
     * Wire this to the attribute update API once the
     * backend update/replace endpoint exists.
     */
    this.editingAttributes.set(false);
  }

  saveBasicDetails(): void {
    if (this.optionForm.controls.title.invalid) {
      this.optionForm.controls.title.markAsTouched();
      return;
    }

    /*
     * UI/form is ready.
     * Wire this to updateDecisionOption(...) once that
     * backend endpoint is available.
     */
    this.editingBasic.set(false);
  }

  removeOption(): void {
    /*
     * Wire to deleteDecisionOption(...) once confirmed.
     */
  }
}