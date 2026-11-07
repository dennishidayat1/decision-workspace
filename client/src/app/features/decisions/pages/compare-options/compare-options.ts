import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonModal,
  IonNote,
  IonRow,
  NavController,
} from '@ionic/angular';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import { toSignal } from '@angular/core/rxjs-interop';

import { addIcons } from 'ionicons';
import { star } from 'ionicons/icons';

import { DecisionState } from '../../state/decision-state';

import {
  CompareOptionSelector,
} from '../../components/compare-option-selector/compare-option-selector';

@Component({
  selector: 'app-compare-options',
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonNote,
    IonModal,
    CompareOptionSelector,
  ],
  templateUrl: './compare-options.html',
  styleUrl: './compare-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareOptions {
  private readonly decisionState =
    inject(DecisionState);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly navController =
    inject(NavController);

  readonly decision =
    this.decisionState.decision;

  readonly options =
    this.decisionState.options;

  readonly criteria =
    this.decisionState.criteria;

  readonly optionAttributes =
    this.decisionState.optionAttributes;

  readonly optionScores =
    this.decisionState.optionScores;

  readonly selectorOpen =
    signal(false);

  private readonly queryParams =
    toSignal(
      this.route.queryParamMap,
      {
        initialValue:
          this.route.snapshot.queryParamMap,
      },
    );

  readonly selectedOptionIds =
    computed(() => {
      const value =
        this.queryParams().get('options');

      if (!value) {
        return [];
      }

      return value
        .split(',')
        .filter(Boolean)
        .slice(0, 4);
    });

  readonly selectedOptions =
    computed(() => {
      const ids =
        this.selectedOptionIds();

      return this.options().filter(
        option =>
          ids.includes(option.id),
      );
    });

  readonly attributeNames =
    computed(() => {
      const attributesByOption =
        this.optionAttributes();

      const names =
        this.selectedOptions()
          .flatMap(
            option =>
              attributesByOption[
              option.id
              ] ?? [],
          )
          .map(
            attribute =>
              attribute.name,
          );

      return [...new Set(names)];
    });

  constructor() {
    addIcons({
      star,
    });
  }

  openSelector(): void {
    this.selectorOpen.set(true);
  }

  closeSelector(): void {
    this.selectorOpen.set(false);
  }

  updateComparison(
    optionIds: string[],
  ): void {
    this.selectorOpen.set(false);

    void this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: {
          options:
            optionIds.join(','),
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      },
    );
  }

  attributeValue(
    optionId: string,
    attributeName: string,
  ): string {
    const attributes =
      this.optionAttributes()[
      optionId
      ] ?? [];

    return (
      attributes.find(
        attribute =>
          attribute.name ===
          attributeName,
      )?.value ?? '—'
    );
  }

  scoreFor(
    optionId: string,
    criterionId: string,
  ): number | null {
    const scores =
      this.optionScores()[
      optionId
      ] ?? [];

    return (
      scores.find(
        score =>
          score.criterionId ===
          criterionId,
      )?.score ?? null
    );
  }

  weightedScore(
    optionId: string,
  ): number | null {
    const ratedCriteria =
      this.criteria()
        .map(criterion => {
          const score =
            this.scoreFor(
              optionId,
              criterion.id,
            );

          if (score === null) {
            return null;
          }

          return {
            score,
            weight:
              criterion.importance,
          };
        })
        .filter(
          (
            item,
          ): item is {
            score: number;
            weight: number;
          } =>
            item !== null,
        );

    if (!ratedCriteria.length) {
      return null;
    }

    const weightedTotal =
      ratedCriteria.reduce(
        (total, item) =>
          total +
          item.score *
          item.weight,
        0,
      );

    const totalWeight =
      ratedCriteria.reduce(
        (total, item) =>
          total +
          item.weight,
        0,
      );

    return (
      weightedTotal /
      totalWeight
    );
  }

  goBack(): void {
    this.navController.back();
  }
}