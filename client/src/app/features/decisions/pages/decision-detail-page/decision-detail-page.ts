import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
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

@Component({
  imports: [ReactiveFormsModule],
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
  readonly optionAttributes = signal<
    Record<string, DecisionOptionAttribute[]>
  >({});
  readonly criteria = signal<Criterion[] | []>([]);
  readonly selectedOptionIdForAttribute = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly optionSubmitError = signal<string | null>(null);
  readonly attributeSubmitError = signal<string | null>(null);
  readonly criterionSubmitError = signal<string | null>(null);
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
}
