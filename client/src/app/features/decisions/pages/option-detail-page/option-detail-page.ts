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
import { DecisionApi } from '../../services/decision-api';

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
  private readonly decisionApi = inject(DecisionApi);

  readonly decisionId = this.route.snapshot.paramMap.get('id') ?? null;
  readonly optionId = this.route.snapshot.paramMap.get('optionId');

  readonly optionForm = createOptionForm();

  readonly editingAttributes = signal(false);
  readonly editingBasic = signal(false);

  readonly showMoreScores = signal(false);
  readonly showMoreAttributes = signal(false);
  readonly formHydrated = signal(false);
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

    const scoreArray = this.optionForm.controls.scores;

    for (const criterion of this.criteria()) {
      const persistedScore = this.scores().find(
        score =>
          score.criterionId === criterion.id,
      );

      const existingForm =
        scoreArray.controls.find(
          scoreGroup =>
            scoreGroup.controls.criterionId.value ===
            criterion.id,
        );

      if (existingForm) {
        existingForm.patchValue({
          score:
            persistedScore?.score ?? null,

          comment:
            persistedScore?.comment ?? '',
        });

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

          score: new FormControl<number | null>(
            persistedScore?.score ?? null,
          ),

          comment: new FormControl(
            persistedScore?.comment ?? '',
            {
              nonNullable: true,
            },
          ),
        }) as ScoreFormGroup,
      );
    }

    this.hydratedOptionId = option.id;


    this.hydratedOptionId = option.id;
    this.formHydrated.set(true);
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

    this.navController.navigateBack(['/decisions', this.decisionId]);
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
    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }

    const requests =
      this.optionForm.controls.attributes.controls
        .map(attribute => {
          const value =
            attribute.getRawValue();

          return {
            name: value.name.trim(),
            value: value.value.trim(),
          };
        })
        .filter(attribute =>
          attribute.name &&
          attribute.value
        );

    this.decisionApi
      .updateDecisionOptionAttributes(
        this.decisionId,
        this.optionId,
        requests,
      )
      .subscribe({
        next: updatedAttributes => {
          this.decisionState
            .updateOptionAttributes(
              this.optionId!,
              updatedAttributes,
            );

          this.editingAttributes.set(false);
        },

        error: error => {
          console.error(
            'Failed to save attributes:',
            error,
          );
        },
      });
  }

  saveBasicDetails(): void {
    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }

    if (
      this.optionForm.controls.title.invalid
    ) {
      this.optionForm.controls.title.markAsTouched();
      return;
    }

    const value =
      this.optionForm.getRawValue();

    this.decisionApi
      .updateDecisionOption(
        this.decisionId,
        this.optionId,
        {
          title: value.title.trim(),
          url:
            value.url.trim() || undefined,
          thumbnailUrl:
            value.thumbnailUrl.trim() || undefined,
          description:
            value.description.trim() || undefined,
          price: value.price ?? undefined,
          currency:
            value.currency || undefined,

          attributes: [],
          scores: [],
        },
      )
      .subscribe({
        next: updatedOption => {
          this.decisionState.updateOption(
            updatedOption,
          );

          this.editingBasic.set(false);
        },

        error: (error) => {
          console.error(
            'Failed to update option:',
            error,
          );
        },
      });
  }

  saveScore(event: {
    criterionId: string;
    score: number;
    comment: string;
  }): void {
    if (!this.optionId) {
      return;
    }

    this.decisionApi
      .createOptionScore(
        this.optionId,
        {
          criterionId: event.criterionId,
          score: event.score,
          comment:
            event.comment || undefined,
        },
      )
      .subscribe({
        next: updatedScore => {
          this.decisionState.updateOptionScore(
            this.optionId!,
            updatedScore,
          );
        },

        error: error => {
          console.error(
            'Failed to save score:',
            error,
          );
        },
      });
  }

  removeOption(): void {
    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }

    this.deleting.set(true);

    this.decisionApi
      .deleteDecisionOption(
        this.decisionId,
        this.optionId,
      )
      .subscribe({
        next: () => {
          this.decisionState.removeOption(
            this.optionId!,
          );

          this.navController.navigateBack(
            ['/decisions', this.decisionId],
          );
        },

        error: error => {
          console.error(
            'Failed to delete option:',
            error,
          );

          this.deleting.set(false);
        },
      });
  }
}