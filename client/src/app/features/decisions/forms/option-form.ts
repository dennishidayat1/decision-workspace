import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';

export type AttributeFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
}>;

export type ScoreFormGroup = FormGroup<{
  criterionId: FormControl<string>;
  score: FormControl<number | null>;
  comment: FormControl<string>;
}>;

export type OptionFormGroup = FormGroup<{
  title: FormControl<string>;
  url: FormControl<string>;
  thumbnailUrl: FormControl<string>;
  description: FormControl<string>;
  price: FormControl<number | null>;
  currency: FormControl<string>;
  attributes: FormArray<AttributeFormGroup>;
  scores: FormArray<ScoreFormGroup>;
}>;

export function createOptionForm(): OptionFormGroup {
  return new FormGroup({
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

    currency: new FormControl('IDR', {
      nonNullable: true,
    }),

    attributes: new FormArray<AttributeFormGroup>([]),

    scores: new FormArray<ScoreFormGroup>([]),
  });
}