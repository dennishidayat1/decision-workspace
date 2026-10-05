import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { DecisionApi } from '../../services/decision-api';
import { Decision } from '../../models/decision';
import { finalize } from 'rxjs';
import { DecisionOption } from '../../models/decision-option';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { CreateDecisionOptionAttributeRequest } from '../../models/create-decision-option-attribute-request';
import { CreateCriterionRequest } from '../../models/create-criterion-request';
import { CreateOptionScoreRequest } from '../../models/create-option-score-request';
import { DecisionState } from '../../state/decision-state';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonFab,
  IonFabButton,
} from '@ionic/angular';

import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  arrowBackOutline,
  bagHandleOutline,
  chevronForwardOutline,
  ellipsisHorizontal,
  gitCompareOutline,
  gridOutline,
  layersOutline,
  listOutline,
  optionsOutline,
  star,
  swapVerticalOutline,
} from 'ionicons/icons';

addIcons({
  addOutline,
  arrowBackOutline,
  bagHandleOutline,
  chevronForwardOutline,
  ellipsisHorizontal,
  gitCompareOutline,
  gridOutline,
  layersOutline,
  listOutline,
  optionsOutline,
  star,
  swapVerticalOutline,
});

type OptionSort =
  | { type: 'best' }
  | { type: 'price-low' }
  | { type: 'price-high' }
  | { type: 'criterion'; criterionId: string };

type OptionGroup =
  | { type: 'none' }
  | { type: 'attribute'; attributeName: string };

interface OptionGroupResult {
  name: string;
  options: DecisionOption[];
}

type OptionView = 'list' | 'grid';

@Component({
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonChip,
    IonContent,
    IonSelect,
    IonSelectOption,
    IonText,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonFab,
    IonFabButton,
  ],
  selector: 'app-decision-detail-page',
  styleUrl: './decision-detail-page.scss',
  templateUrl: './decision-detail-page.html',
})

export class DecisionDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly decisionApi = inject(DecisionApi);
  private readonly decisionState = inject(DecisionState);

  ngOnInit(): void {
    this.loadDecision();
  }

  ionViewWillEnter(): void {
    if (this.decisionId) {
      this.decisionState.ensureDecisionLoaded(this.decisionId);
    }
  }

  readonly decisionId = this.route.snapshot.paramMap.get('id');
  readonly decision = signal<Decision | null>(null);
  readonly decisionOptions = this.decisionState.options;
  readonly optionAttributes = this.decisionState.optionAttributes;
  readonly criteria = this.decisionState.criteria;
  readonly selectedOptionIdForAttribute = signal<string | null>(null);
  readonly optionScores = this.decisionState.optionScores;
  readonly optionScoreForms = new Map<string, FormGroup>();
  readonly isCriterionFormOpen = signal(false);
  readonly selectedOptionIdForScoring = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly attributeSubmitError = signal<string | null>(null);
  readonly criterionSubmitError = signal<string | null>(null);
  readonly optionScoreSubmitError = signal<string | null>(null);
  readonly optionSort = signal<OptionSort>({ type: 'best' });
  readonly optionView = signal<OptionView>('grid');
  readonly optionSortValue = computed(() => {
    const sort = this.optionSort();

    return sort.type === 'criterion'
      ? sort.criterionId
      : sort.type;
  });
  readonly optionGroup = signal<OptionGroup>({ type: 'none' });
  readonly optionGroupValue = computed(() => {
    const group = this.optionGroup();

    return group.type === 'attribute'
      ? group.attributeName
      : 'none';
  });
  readonly groupedDecisionOptions = computed<OptionGroupResult[]>(() => {
    const options = this.sortedDecisionOptions();
    const group = this.optionGroup();

    if (group.type === 'none') {
      return [
        {
          name: 'All',
          options,
        },
      ];
    }

    const attributesByOption = this.optionAttributes();

    const groups = new Map<string, DecisionOption[]>();
    const otherOptions: DecisionOption[] = [];

    for (const option of options) {
      const attributes = attributesByOption[option.id] ?? [];

      const groupingAttribute = attributes.find(
        (attribute) => attribute.name === group.attributeName,
      );

      if (!groupingAttribute) {
        otherOptions.push(option);
        continue;
      }

      const groupName = groupingAttribute.value;
      const existingOptions = groups.get(groupName) ?? [];

      groups.set(groupName, [...existingOptions, option]);
    }

    const result = Array.from(groups, ([name, options]) => ({
      name,
      options,
    }));

    if (otherOptions.length > 0) {
      result.push({
        name: 'Other',
        options: otherOptions,
      });
    }

    return result;
  });
  // readonly optionForm = new FormGroup({
  //   title: new FormControl('', {
  //     nonNullable: true,
  //     validators: [Validators.required],
  //   }),
  //   url: new FormControl('', {
  //     nonNullable: true,
  //   }),
  //   thumbnailUrl: new FormControl('', {
  //     nonNullable: true,
  //   }),
  //   description: new FormControl('', {
  //     nonNullable: true,
  //   }),
  //   price: new FormControl<number | null>(null),
  //   currency: new FormControl('', {
  //     nonNullable: true,
  //   }),

  //   attributes: new FormArray<
  //     FormGroup<{
  //       name: FormControl<string>;
  //       value: FormControl<string>;
  //     }>
  //   >([]),
  // });

  readonly availableAttributeNames = this.decisionState.availableAttributeNames;

  readonly optionAttributesForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    value: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly criterionForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    importance: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(5),
      ],
    }),
    context: new FormControl('', {
      nonNullable: true,
    }),
  });
  readonly optionScoreForm = new FormGroup({
    score: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(5),
      ],
    }),
    comment: new FormControl('', {
      nonNullable: true,
    }),
  });

  readonly sortedDecisionOptions = computed(() => {
    const options = this.decisionOptions();

    const sortMode = this.optionSort();

    return [...options].sort((a, b) => {
      if (sortMode.type === 'price-low') {
        const priceA = a.price;
        const priceB = b.price;

        if (priceA === undefined && priceB === undefined) {
          return 0;
        }

        if (priceA === undefined) {
          return 1;
        }

        if (priceB === undefined) {
          return -1;
        }

        return priceA - priceB;
      }

      if (sortMode.type === 'price-high') {
        const priceA = a.price;
        const priceB = b.price;

        if (priceA === undefined && priceB === undefined) {
          return 0;
        }

        if (priceA === undefined) {
          return 1;
        }

        if (priceB === undefined) {
          return -1;
        }

        return priceB - priceA;
      }

      if (sortMode.type === 'criterion') {
        const scoreA = (this.optionScores()[a.id] ?? []).find(
          (score) => score.criterionId === sortMode.criterionId,
        );

        const scoreB = (this.optionScores()[b.id] ?? []).find(
          (score) => score.criterionId === sortMode.criterionId,
        );

        if (!scoreA && !scoreB) {
          return 0;
        }

        if (!scoreA) {
          return 1;
        }

        if (!scoreB) {
          return -1;
        }

        return scoreB.score - scoreA.score;
      }

      const scoreA = this.getWeightedScore(a.id);
      const scoreB = this.getWeightedScore(b.id);

      if (scoreA === null && scoreB === null) {
        return 0;
      }

      if (scoreA === null) {
        return 1;
      }

      if (scoreB === null) {
        return -1;
      }

      return scoreB - scoreA;
    });
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

  readonly bestOptionId = computed(() => {
    let bestId: string | null = null;
    let bestScore = -Infinity;

    for (const option of this.decisionOptions()) {
      const score = this.getWeightedScore(option.id);

      if (score !== null && score > bestScore) {
        bestScore = score;
        bestId = option.id;
      }
    }

    return bestId;
  });

  private loadDecisionOptions(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    this.decisionState.ensureDecisionLoaded(this.decisionId);
  }

  openAttributeForm(decisionOptionId: string): void {
    this.selectedOptionIdForAttribute.set(decisionOptionId);
    this.optionAttributesForm.reset();
  }

  closeAttributeForm(): void {
    this.selectedOptionIdForAttribute.set(null);
    this.optionAttributesForm.reset();
  }

  onAddAttribute(): void {
    const decisionOptionId = this.selectedOptionIdForAttribute();
    if (!this.decisionId || !decisionOptionId) {
      console.error('Decision ID or Decision Option ID is not available.');
      this.loadError.set('Decision ID or Decision Option ID is missing.');
      return;
    }

    if (this.optionAttributesForm.invalid) {
      console.error('Attribute form is invalid:', this.optionAttributesForm.errors);
      this.attributeSubmitError.set(
        'Please fill in all required fields for the attribute.',
      );
      return;
    }

    this.attributeSubmitError.set(null);

    const request: CreateDecisionOptionAttributeRequest = this.optionAttributesForm.getRawValue();

    this.decisionApi.createDecisionOptionAttribute(this.decisionId, decisionOptionId, request).subscribe({
      next: (createdAttribute) => {
        this.optionAttributes.update((currentAttributes) => {
          const updatedAttributes = currentAttributes[decisionOptionId] || [];
          return {
            ...currentAttributes,
            [decisionOptionId]: [...updatedAttributes, createdAttribute],
          };
        });
        this.closeAttributeForm();
      },
      error: (error) => {
        console.error('Failed to create decision option attribute:', error);
        this.attributeSubmitError.set(
          'Failed to create decision option attribute. Please try again later.',
        );
      },
    });
  }

  onAddCriterion(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    if (this.criterionForm.invalid) {
      console.error('Criterion form is invalid:', this.criterionForm.errors);
      this.criterionSubmitError.set(
        'Please fill in all required fields for the criterion.',
      );
      return;
    }

    this.criterionSubmitError.set(null);

    const formValue = this.criterionForm.getRawValue();

    if (formValue.importance === null) {
      this.criterionSubmitError.set('Please select an importance.');
      return;
    }

    const request: CreateCriterionRequest = {
      name: formValue.name,
      importance: formValue.importance,
      context: formValue.context || undefined,
    };

    this.decisionApi.createCriterion(this.decisionId, request).subscribe({
      next: (createdCriterion) => {
        this.criteria.update((currentCriteria) => [...currentCriteria, createdCriterion]);
        this.criterionForm.reset();
      },
      error: (error) => {
        console.error('Failed to create criterion:', error);
        this.criterionSubmitError.set(
          'Failed to create criterion. Please try again later.',
        );
      },
    });
  }

  onSaveOptionScore(decisionOptionId: string, criterionId: string): void {

    const form = this.getOptionScoreForm(decisionOptionId, criterionId);

    if (!decisionOptionId) {
      console.error('Decision option ID is not available.');
      this.optionScoreSubmitError.set('Decision option ID is missing.');
      return;
    }

    if (form.invalid) {
      form.markAllAsTouched();
      this.optionScoreSubmitError.set(
        'Please fill in all required fields for the option score',
      );
      return;
    }

    this.optionScoreSubmitError.set(null)

    const formValue = form.getRawValue();

    if (formValue.score === null) {
      return
    }

    const request: CreateOptionScoreRequest = {
      criterionId,
      score: formValue.score,
      comment: formValue.comment
    }

    this.decisionApi.createOptionScore(decisionOptionId, request).subscribe({
      next: (savedScore) => {

        this.optionScores.update((existingScores) => {
          const currentScores = existingScores[decisionOptionId] ?? [];

          const scoreExists = currentScores.some(
            (score) => score.criterionId === savedScore.criterionId
          );
          const updatedScores = scoreExists
            ? currentScores.map((score) =>
              score.criterionId === savedScore.criterionId
                ? savedScore
                : score
            )
            : [...currentScores, savedScore];

          return {
            ...existingScores,
            [decisionOptionId]: updatedScores,
          };
        })

        form.reset();
      },
      error: (error) => {
        console.error('Failed to submit option score:', error);
        this.optionScoreSubmitError.set(
          'Failed to submit option score. Please try again later.',
        );
      }
    })
  }

  private getOptionScoreKey(decisionOptionId: string, criterionId: string,): string {
    return `${decisionOptionId}:${criterionId}`;
  }

  getOptionScoreForm(decisionOptionId: string, criterionId: string,): FormGroup {
    const key = this.getOptionScoreKey(decisionOptionId, criterionId);
    const existingForm = this.optionScoreForms.get(key);

    if (existingForm) {
      return existingForm;
    }

    const savedScore = (this.optionScores()[decisionOptionId] ?? []).find(
      (score) => score.criterionId === criterionId,
    );

    const newForm = new FormGroup({
      score: new FormControl<number | null>(savedScore?.score ?? null, {
        validators: [
          Validators.required,
          Validators.min(1),
          Validators.max(5),
        ],
      }),
      comment: new FormControl(savedScore?.comment ?? '', {
        nonNullable: true,
      }),
    });

    this.optionScoreForms.set(key, newForm);

    return newForm;
  }

  getWeightedScore(decisionOptionId: string): number | null {
    const scores = this.optionScores()[decisionOptionId] ?? [];

    if (scores.length === 0) {
      return null;
    }

    const weightedTotal = scores.reduce((total, optionScore) => {
      const criterion = this.criteria().find(
        (criterion) => criterion.id === optionScore.criterionId,
      );

      if (!criterion) {
        return total;
      }

      return total + optionScore.score * criterion.importance;
    }, 0);

    const totalImportance = scores.reduce((total, optionScore) => {
      const criterion = this.criteria().find(
        (criterion) => criterion.id === optionScore.criterionId,
      );

      if (!criterion) {
        return total;
      }

      return total + criterion.importance;
    }, 0);

    if (totalImportance === 0) {
      return null;
    }

    return weightedTotal / totalImportance;
  }

  onOptionSortChange(value: string): void {
    if (
      value === 'best' ||
      value === 'price-low' ||
      value === 'price-high'
    ) {
      this.optionSort.set({ type: value });
      return;
    }

    this.optionSort.set({
      type: 'criterion',
      criterionId: value,
    });
  }

  onOptionGroupChange(value: string): void {
    if (value === 'none') {
      this.optionGroup.set({ type: 'none' });
      return;
    }

    this.optionGroup.set({
      type: 'attribute',
      attributeName: value,
    });
  }

  toggleScoreEditor(optionId: string): void {
    this.selectedOptionIdForScoring.update((currentId) =>
      currentId === optionId ? null : optionId
    );
  }

  getCriterionName(criterionId: string): string {
    return this.criteria().find(
      (criterion) => criterion.id === criterionId
    )?.name ?? 'Unknown';
  }

  setOptionView(view: OptionView): void {
    this.optionView.set(view);
  }

  onOptionViewChange(value: string | number | undefined): void {
    if (value === 'list' || value === 'grid') {
      this.setOptionView(value);
    }
  }

  getCompactOptionScores(optionId: string) {
    return [...(this.optionScores()[optionId] ?? [])]
      .sort((a, b) => {
        const aImportance =
          this.criteria().find(
            criterion => criterion.id === a.criterionId
          )?.importance ?? 0;

        const bImportance =
          this.criteria().find(
            criterion => criterion.id === b.criterionId
          )?.importance ?? 0;

        return bImportance - aImportance;
      })
      .slice(0, 2);
  }
}
