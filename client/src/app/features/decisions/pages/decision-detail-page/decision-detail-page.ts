import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DecisionApi } from '../../services/decision-api';
import { Decision } from '../../models/decision';
import { finalize } from 'rxjs';
import { DecisionOption } from '../../models/decision-option';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateDecisionOptionRequest } from '../../models/create-decision-option-request';
import { DecisionOptionAttribute } from '../../models/decision-option-attribute';
import { CreateDecisionOptionAttributeRequest } from '../../models/create-decision-option-attribute-request';
import { Criterion } from '../../models/criterion';
import { CreateCriterionRequest } from '../../models/create-criterion-request';
import { OptionScore } from '../../models/option-score';
import { CreateOptionScoreRequest } from '../../models/create-option-score-request';
import { computed } from '@angular/core';

type OptionSort =
  | { type: 'best' }
  | { type: 'price-low' }
  | { type: 'price-high' }
  | { type: 'criterion'; criterionId: string };

@Component({
  imports: [ReactiveFormsModule, DecimalPipe],
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
    this.loadCriteria();
  }

  readonly decisionId = this.route.snapshot.paramMap.get('id');
  readonly decision = signal<Decision | null>(null);
  readonly decisionOptions = signal<DecisionOption[]>([]);
  readonly optionAttributes = signal<Record<string, DecisionOptionAttribute[]>>({});
  readonly criteria = signal<Criterion[] | []>([]);
  readonly selectedOptionIdForAttribute = signal<string | null>(null);
  readonly optionScores = signal<Record<string, OptionScore[]>>({});
  readonly optionScoreForms = new Map<string, FormGroup>();
  readonly optionSort = signal<OptionSort>({ type: 'best' });
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly optionSubmitError = signal<string | null>(null);
  readonly attributeSubmitError = signal<string | null>(null);
  readonly criterionSubmitError = signal<string | null>(null);
  readonly optionScoreSubmitError = signal<string | null>(null);
  readonly optionSortValue = computed(() => {
    const sort = this.optionSort();

    return sort.type === 'criterion'
      ? sort.criterionId
      : sort.type;
  });
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

  private loadDecisionOptions(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    this.decisionApi.getDecisionOptions(this.decisionId).subscribe({
      next: (options) => {
        this.decisionOptions.set(options);
        options.forEach((option) => {
          this.loadOptionAttributes(option.id);
          this.loadOptionScores(option.id)
        });
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

  private loadOptionAttributes(decisionOptionId: string): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    this.decisionApi.getDecisionOptionAttributes(this.decisionId, decisionOptionId).subscribe({
      next: (attributes) => {
        this.optionAttributes.update((currentAttributes) => ({
          ...currentAttributes,
          [decisionOptionId]: attributes,
        }));
      },
      error: (error) => {
        console.error(`Failed to load attributes for option ${decisionOptionId}:`, error);
        this.loadError.set(
          `Failed to load attributes for option ${decisionOptionId}. Please try again later.`,
        );
      },
    });
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

  private loadCriteria(): void {
    if (!this.decisionId) {
      console.error('Decision ID is not available in the route parameters.');
      this.loadError.set('Decision ID is missing.');
      return;
    }

    this.decisionApi.getCriteria(this.decisionId).subscribe({
      next: (criteria) => {
        this.criteria.set(criteria);
      },
      error: (error) => {
        console.error('Failed to load criteria:', error);
        this.loadError.set('Failed to load criteria. Please try again later.');
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

  private loadOptionScores(decisionOptionId: string): void {
    if (!decisionOptionId) {
      this.loadError.set('Decision Option Id is empty')
      console.log('Decision Option Id is empty')
      return
    }

    this.decisionApi.getOptionScores(decisionOptionId).subscribe({
      next: (newOptionScore) => {
        this.optionScores.update((currentOptionScore) => (
          { ...currentOptionScore, [decisionOptionId]: newOptionScore })
        );
      },
      error: (error) => {
        console.error('Failed to load option score:', error);
        this.loadError.set(
          'Failed to load option score. Please try again later.',
        );
      }
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
}
