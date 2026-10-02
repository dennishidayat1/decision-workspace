import { Component, effect, input } from '@angular/core';
import {
  ReactiveFormsModule,
  FormArray,
  FormControl,
  FormGroup,
} from '@angular/forms';

import { Criterion } from '../../models/criterion';

type ScoreFormGroup = FormGroup<{
  criterionId: FormControl<string>;
  score: FormControl<number | null>;
  comment: FormControl<string>;
}>;

@Component({
  imports: [
    ReactiveFormsModule
  ],
  selector: 'app-score-form',
  styleUrl: './score-form.scss',
  templateUrl: './score-form.html',
})
export class ScoreForm {
  readonly criteria = input.required<readonly Criterion[]>();
  readonly scores = input.required<FormArray<ScoreFormGroup>>();

  private readonly populateCriteria = effect(() => {
    const criteria = this.criteria();
    const scores = this.scores();

    const existingCriterionIds = new Set(
      scores.controls.map(
        (score) => score.controls.criterionId.value,
      ),
    );

    for (const criterion of criteria) {
      if (!existingCriterionIds.has(criterion.id)) {
        scores.push(
          new FormGroup({
            criterionId: new FormControl(criterion.id, {
              nonNullable: true,
            }),
            score: new FormControl<number | null>(null),
            comment: new FormControl('', {
              nonNullable: true,
            }),
          }),
        );
      }
    }
  });

  getCriterionName(criterionId: string): string {
    return (
      this.criteria().find(
        (criterion) => criterion.id === criterionId,
      )?.name ?? 'Unknown criterion'
    );
  }
}
