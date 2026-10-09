import {
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';

import {
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
} from '@angular/router';

import {
  forkJoin,
  Observable,
} from 'rxjs';

import {
  DecisionApi,
} from '../../services/decision-api';

import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRow,
  IonSpinner,
  NavController,
} from '@ionic/angular';

import {
  addIcons,
} from 'ionicons';

import {
  arrowBackOutline,
  checkmarkOutline,
} from 'ionicons/icons';

import {
  CriteriaForm,
} from '../../components/criteria-form/criteria-form';

import {
  createCriterionDraftForm,
  CriterionDraftFormGroup,
} from '../../forms/decision-form';

import {
  DecisionState,
} from '../../state/decision-state';


addIcons({
  arrowBackOutline,
  checkmarkOutline,
});


@Component({
  selector: 'app-edit-criteria-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,

    CriteriaForm,

    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonRow,
    IonSpinner,
  ],
  templateUrl: './edit-criteria-page.html',
  styleUrl: './edit-criteria-page.scss',
})
export class EditCriteriaPage {
  private readonly route =
    inject(ActivatedRoute);

  private readonly navController =
    inject(NavController);

  readonly decisionState =
    inject(DecisionState);

  private readonly decisionApi =
    inject(DecisionApi);


  readonly decisionId =
    this.route.snapshot.paramMap.get('id');


  readonly criteria =
    new FormArray<CriterionDraftFormGroup>([]);


  readonly isSubmitting =
    signal(false);

  readonly loadError =
    signal<string | null>(null);

  readonly submitError =
    signal<string | null>(null);


  readonly hydrated =
    signal(false);


  private readonly persistedCriterionIds =
    new WeakMap<
      CriterionDraftFormGroup,
      string
    >();


  private readonly originalCriterionIds =
    new Set<string>();


  constructor() {
    effect(() => {
      const loadStatus =
        this.decisionState.loadStatus();

      const persistedCriteria =
        this.decisionState.criteria();

      if (
        loadStatus !== 'loaded' ||
        this.hydrated()
      ) {
        return;
      }

      this.populateCriteria(
        persistedCriteria,
      );

      this.hydrated.set(true);
    });
  }


  ionViewWillEnter(): void {
    this.loadError.set(null);
    this.submitError.set(null);

    this.hydrated.set(false);

    if (!this.decisionId) {
      this.loadError.set(
        'Decision ID is missing.',
      );

      return;
    }

    this.decisionState
      .ensureDecisionLoaded(
        this.decisionId,
      );
  }


  private populateCriteria(
    persistedCriteria:
      ReturnType<
        typeof this.decisionState.criteria
      >,
  ): void {
    this.criteria.clear();

    this.originalCriterionIds.clear();

    for (
      const persistedCriterion
      of persistedCriteria
    ) {
      const form =
        createCriterionDraftForm();

      form.patchValue({
        name:
          persistedCriterion.name,

        importance:
          persistedCriterion.importance,

        context:
          persistedCriterion.context ?? '',
      });

      this.persistedCriterionIds.set(
        form,
        persistedCriterion.id,
      );

      this.originalCriterionIds.add(
        persistedCriterion.id,
      );

      this.criteria.push(form);
    }

    this.criteria.markAsPristine();
    this.criteria.markAsUntouched();
  }


  hasIncompleteCriterion(): boolean {
    return this.criteria.controls.some(
      (criterion) =>
        !criterion.controls.name.value.trim(),
    );
  }


  save(): void {
    if (
      this.criteria.invalid ||
      this.hasIncompleteCriterion()
    ) {
      this.criteria.markAllAsTouched();
      return;
    }

    const existing = [];
    const created = [];

    const currentPersistedIds =
      new Set<string>();


    for (
      const criterion
      of this.criteria.controls
    ) {
      const value =
        criterion.getRawValue();

      const persistedId =
        this.persistedCriterionIds.get(
          criterion,
        );

      const draft = {
        name:
          value.name.trim(),

        importance:
          value.importance,

        context:
          value.context.trim() ||
          undefined,
      };


      if (persistedId) {
        currentPersistedIds.add(
          persistedId,
        );

        existing.push({
          id: persistedId,
          ...draft,
        });
      } else {
        created.push(draft);
      }
    }


    const deleted =
      [...this.originalCriterionIds]
        .filter(
          (id) =>
            !currentPersistedIds.has(id),
        );


    if (!this.decisionId) {
      this.submitError.set(
        'Decision ID is missing.',
      );
      return;
    }

    const requests: Observable<unknown>[] = [];


    for (const criterion of existing) {
      requests.push(
        this.decisionApi.updateCriterion(
          this.decisionId,
          criterion.id,
          {
            name: criterion.name,
            importance: criterion.importance,
            context: criterion.context,
          },
        ),
      );
    }


    for (const criterion of created) {
      requests.push(
        this.decisionApi.createCriterion(
          this.decisionId,
          criterion,
        ),
      );
    }


    for (const criterionId of deleted) {
      requests.push(
        this.decisionApi.deleteCriterion(
          this.decisionId,
          criterionId,
        ),
      );
    }


    if (requests.length === 0) {
      this.cancel();
      return;
    }


    this.isSubmitting.set(true);
    this.submitError.set(null);


    forkJoin(requests)
      .subscribe({
        next: () => {
          this.decisionState.invalidateDecision(
            this.decisionId!,
          );

          this.navController.navigateBack(
            `/decisions/${this.decisionId}`,
          );
        },

        error: (error) => {
          console.error(
            'Failed to save criteria:',
            error,
          );

          this.submitError.set(
            'Failed to save criteria. Please try again.',
          );

          this.isSubmitting.set(false);
        },
      });
  }


  cancel(): void {
    if (this.decisionId) {
      this.navController.navigateBack(
        `/decisions/${this.decisionId}`,
      );

      return;
    }

    this.navController.navigateBack(
      '/decisions',
    );
  }
}