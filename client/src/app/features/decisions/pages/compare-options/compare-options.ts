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

import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

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

  readonly decisionId = signal<string | null>(null);
  readonly workspaceReady = computed(() =>
    !!this.decisionId() &&
    this.decisionState.decisionId() === this.decisionId() &&
    this.decisionState.decision()?.id === this.decisionId() &&
    this.decisionState.loadStatus() === 'loaded',
  );
  readonly loading = computed(() => !!this.decisionId() &&
    (this.decisionState.decisionId() !== this.decisionId() ||
      this.decisionState.loadStatus() === 'idle' ||
      this.decisionState.loadStatus() === 'loading'));
  readonly loadMessage = computed(() => {
    if (!this.decisionId()) return 'The comparison URL is missing a decision ID.';
    if (this.loading() || this.workspaceReady()) return null;
    switch (this.decisionState.loadErrorStatus()) {
      case 400: return 'The decision ID in this URL is invalid.';
      case 404: return 'This decision was not found or is no longer available.';
      case 401:
      case 403: return 'You do not have access to this decision. Please sign in again.';
      default: return 'Unable to load this decision. Please try again.';
    }
  });
  readonly decision = computed(() => this.workspaceReady() ? this.decisionState.decision() : null);
  readonly options = computed(() => this.workspaceReady() ? this.decisionState.options() : []);
  readonly criteria = computed(() => this.workspaceReady() ? this.decisionState.criteria() : []);
  readonly optionAttributes = computed(() => this.workspaceReady() ? this.decisionState.optionAttributes() : {});
  readonly optionScores = computed(() => this.workspaceReady() ? this.decisionState.optionScores() : {});

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

  private readonly requestedOptionIds =
    computed(() => {
      const value =
        this.queryParams().get('options');

      if (!value) {
        return [];
      }

      return [...new Set(value.split(',').map(id => id.trim()).filter(Boolean))];
    });

  readonly selectedOptionIds = computed(() => {
    const available = new Set(this.options().map(option => option.id));
    return this.requestedOptionIds().filter(id => available.has(id)).slice(0, 4);
  });
  readonly selectionWarning = computed(() => this.workspaceReady() &&
    (this.requestedOptionIds().some(id => !this.options().some(option => option.id === id)) ||
      this.requestedOptionIds().length > 4));

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
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.closeSelector();
      this.decisionId.set(params.get('id')?.trim() || null);
      this.loadWorkspace();
    });
  }

  ionViewWillEnter(): void {
    this.loadWorkspace();
  }

  loadWorkspace(): void {
    const id = this.decisionId();
    if (id) this.decisionState.ensureDecisionLoaded(id);
  }

  openSelector(): void {
    if (!this.workspaceReady()) return;
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
            [...new Set(optionIds)].filter(id => this.options().some(option => option.id === id)).slice(0, 4).join(','),
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
    const id = this.decisionId();
    void this.navController.navigateBack(id ? ['/decisions', id] : ['/decisions']);
  }
}
