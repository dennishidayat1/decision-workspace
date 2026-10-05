import { Component, effect, input, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormArray,
  FormControl,
  FormGroup,
} from '@angular/forms';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonLabel,
  IonNote,
  IonIcon,
  IonInput,
} from '@ionic/angular';
import { Criterion } from '../../models/criterion';
import { addIcons } from 'ionicons';
import {
  chatboxOutline,
  star,
  starOutline,
} from 'ionicons/icons';

addIcons({
  chatboxOutline,
  star,
  starOutline,
});

type ScoreFormGroup = FormGroup<{
  criterionId: FormControl<string>;
  score: FormControl<number | null>;
  comment: FormControl<string>;
}>;

@Component({
  imports: [
    ReactiveFormsModule,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonLabel,
    IonNote,
    IonIcon,
    IonInput,

  ],
  selector: 'app-score-form',
  styleUrl: './score-form.scss',
  templateUrl: './score-form.html',
})
export class ScoreForm {
  readonly criteria = input.required<readonly Criterion[]>();
  readonly scores = input.required<FormArray<ScoreFormGroup>>();
  readonly ratingValues = [1, 2, 3, 4, 5] as const;

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

  readonly expandedCommentCriterionId =
    signal<string | null>(null);

  toggleComment(criterionId: string): void {
    this.expandedCommentCriterionId.update(
      (current) =>
        current === criterionId
          ? null
          : criterionId,
    );
  }

  closeComment(): void {
    this.expandedCommentCriterionId.set(null);
  }

  getCriterionImportance(
    criterionId: string,
  ): number | null {
    return (
      this.criteria().find(
        (criterion) => criterion.id === criterionId,
      )?.importance ?? null
    );
  }

  getCriterionName(criterionId: string): string {
    return (
      this.criteria().find(
        (criterion) => criterion.id === criterionId,
      )?.name ?? 'Unknown criterion'
    );
  }


  setScore(
    scoreGroup: ScoreFormGroup,
    value: number,
  ): void {
    const scoreControl = scoreGroup.controls.score;

    scoreControl.setValue(
      scoreControl.value === value
        ? null
        : value,
    );
  }

  clearScore(scoreGroup: ScoreFormGroup): void {
    scoreGroup.controls.score.setValue(null);
  }
}
