import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';

export type CriterionDraftFormGroup = FormGroup<{
  name: FormControl<string>;
  importance: FormControl<number>;
  context: FormControl<string>;
}>;

export type DecisionFormGroup = FormGroup<{
  question: FormControl<string>;
  category: FormControl<string>;
  context: FormControl<string>;
  criteria: FormArray<CriterionDraftFormGroup>;
}>;

export function createCriterionDraftForm(): CriterionDraftFormGroup {
  return new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(100),
      ],
    }),

    importance: new FormControl(3, {
      nonNullable: true,
      validators: [
        Validators.min(1),
        Validators.max(5),
      ],
    }),

    context: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(500),
      ],
    }),
  });
}

export function createDecisionForm(): DecisionFormGroup {
  return new FormGroup({
    question: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(240),
      ],
    }),

    category: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(60),
      ],
    }),

    context: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(2000),
      ],
    }),

    criteria: new FormArray<CriterionDraftFormGroup>([]),
  });
}