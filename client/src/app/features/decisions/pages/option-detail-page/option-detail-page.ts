import {
  Component,
  HostListener,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { DecimalPipe } from '@angular/common';

import { ActivatedRoute } from '@angular/router';
import { filter, finalize } from 'rxjs';

import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  IonButton,
  AlertController,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  NavController,
} from '@ionic/angular';

import { addIcons } from 'ionicons';

import {
  arrowBackOutline,
  bagHandleOutline,
  closeOutline,
  openOutline,
  trashOutline,
} from 'ionicons/icons';

import { DecisionState } from '../../state/decision-state';

import {
  AttributeFormGroup,
  ScoreFormGroup,
  createOptionForm,
} from '../../forms/option-form';

import { AttributeForm } from '../../components/attribute-form/attribute-form';

import { ScoreForm } from '../../components/score-form/score-form';

import { DecisionApi } from '../../services/decision-api';
import { OptionImageRecovery } from '../../services/option-image-recovery';
import { OptionImageRecoveryControl } from '../../components/option-image-recovery/option-image-recovery';


addIcons({
  arrowBackOutline,
  bagHandleOutline,
  closeOutline,
  openOutline,
  trashOutline,
});


@Component({
  selector: 'app-option-detail-page',

  imports: [
    DecimalPipe,
    ReactiveFormsModule,

    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,

    AttributeForm,
    ScoreForm,
    OptionImageRecoveryControl,
  ],

  templateUrl: './option-detail-page.html',

  styleUrl: './option-detail-page.scss',
})
export class OptionDetailPage {

  private readonly route =
    inject(ActivatedRoute);

  private readonly decisionState =
    inject(DecisionState);

  private readonly navController =
    inject(NavController);
  private readonly alertController = inject(AlertController);
  private basicEditBaseline: ReturnType<OptionDetailPage['basicValues']> | null = null;
  private attributeEditBaseline = '';
  readonly savingAttributes = signal(false);
  readonly pendingScoreSaves = signal(0);
  private pendingExit: Promise<boolean> | null = null;
  private exitAlert: HTMLIonAlertElement | null = null;
  private exitContext: { account: number; decisionId: string | null; optionId: string | null } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => { void this.exitAlert?.dismiss(undefined, 'cancel'); });
  }

  private readonly dismissStaleConfirmation = effect(() => {
    const account = this.decisionState.accountVersion();
    const decisionId = this.decisionId;
    const optionId = this.optionId;
    if (this.exitContext && (this.exitContext.account !== account ||
      this.exitContext.decisionId !== decisionId || this.exitContext.optionId !== optionId)) {
      void this.exitAlert?.dismiss(undefined, 'cancel');
    }
  });

  private basicValues() {
    const { title, url, thumbnailUrl, description, price, currency } = this.optionForm.getRawValue();
    return { title, url, thumbnailUrl, description, price, currency };
  }

  hasUnsavedBasicChanges(): boolean {
    return this.editingBasic() && this.basicEditBaseline !== null &&
      JSON.stringify(this.basicValues()) !== JSON.stringify(this.basicEditBaseline);
  }

  hasUnsavedChanges(): boolean {
    const savedScores = this.decisionState.optionScores()[this.optionId ?? ''] ?? [];
    return this.hasUnsavedBasicChanges() ||
      (this.editingAttributes() && JSON.stringify(this.optionForm.controls.attributes.getRawValue()) !== this.attributeEditBaseline) ||
      this.optionForm.controls.scores.getRawValue().some(value => {
        const saved = savedScores.find(score => score.criterionId === value.criterionId);
        return value.score !== (saved?.score ?? null) || value.comment.trim() !== (saved?.comment ?? '').trim();
      });
  }

  private exitBlocked(): boolean {
    return this.savingBasic() || this.refreshingImage() || this.savingAttributes() || this.pendingScoreSaves() > 0;
  }

  canLeave = (): Promise<boolean> => {
    // Identity reset must never trap a user on the departing account's page.
    if (!this.option()) return Promise.resolve(true);
    if (this.pendingExit) return this.pendingExit;
    if (this.exitBlocked()) return Promise.resolve(false);
    if (!this.hasUnsavedChanges()) return Promise.resolve(true);
    const account = this.decisionState.accountVersion();
    const decisionId = this.decisionId;
    const optionId = this.optionId;
    this.exitContext = { account, decisionId, optionId };
    const values = JSON.stringify(this.optionForm.getRawValue());
    const pending = this.confirmDiscard().then(confirmed => {
      if (!confirmed || account !== this.decisionState.accountVersion() ||
        decisionId !== this.decisionId || optionId !== this.optionId ||
        values !== JSON.stringify(this.optionForm.getRawValue()) || this.exitBlocked()) return false;
      this.editingBasic.set(false);
      this.editingAttributes.set(false);
      const savedScores = this.decisionState.optionScores()[this.optionId ?? ''] ?? [];
      for (const control of this.optionForm.controls.scores.controls) {
        const saved = savedScores.find(score => score.criterionId === control.controls.criterionId.value);
        control.patchValue({ score: saved?.score ?? null, comment: saved?.comment ?? '' });
      }
      return true;
    }).catch(() => false).finally(() => {
      if (this.pendingExit === pending) {
        this.pendingExit = null;
        this.exitContext = null;
      }
    });
    this.pendingExit = pending;
    return pending;
  };

  private async confirmDiscard(): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Discard unsaved changes?',
      message: 'Your changes to this option have not been saved.',
      backdropDismiss: false,
      buttons: [
        { text: 'Keep editing', role: 'cancel' },
        { text: 'Discard changes', role: 'discard' },
      ],
    });
    this.exitAlert = alert;
    try {
      if (this.exitContext?.account !== this.decisionState.accountVersion() ||
        this.exitContext?.optionId !== this.optionId || this.exitContext?.decisionId !== this.decisionId) return false;
      await alert.present();
      return (await alert.onDidDismiss()).role === 'discard';
    } finally {
      await alert.dismiss();
      if (this.exitAlert === alert) this.exitAlert = null;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  protectBrowserExit(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges() || this.exitBlocked()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  protected readonly decisionApi =
    inject(DecisionApi);
  protected readonly imageRecovery = inject(OptionImageRecovery);


  private readonly routeDecisionId =
    this.route.snapshot.paramMap.get('id') ??
    null;

  private readonly routeOptionId =
    this.route.snapshot.paramMap.get(
      'optionId',
    );


  readonly panelDecisionId =
    input<string | null>(null);

  readonly panelOptionId =
    input<string | null>(null);

  readonly presentation =
    input<'page' | 'panel'>('page');

  readonly closeRequested =
    output<void>();


  private readonly content =
    viewChild(IonContent);



  get decisionId(): string | null {
    return (
      this.panelDecisionId() ??
      this.routeDecisionId
    );
  }


  get optionId(): string | null {
    return (
      this.panelOptionId() ??
      this.routeOptionId
    );
  }


  readonly optionForm =
    createOptionForm();


  readonly editingAttributes =
    signal(false);

  readonly editingBasic =
    signal(false);

  readonly refreshingImage = computed(() => {
    const option = this.option();
    return !!option && this.imageRecovery.pending(option);
  });
  readonly imageRefreshError = signal<string | null>(null);
  readonly confirmImageReplacement = signal(false);
  readonly basicSaveError = signal<string | null>(null);
  readonly savingBasic = signal(false);
  private basicEditVersion: string | undefined;

  readonly canRefreshImage = computed(() =>
    this.decisionApi.supportsMarketplaceSource(this.option()?.sourceUrl));

  private readonly scoreForm = viewChild(ScoreForm);
  private readonly clearRetryError = effect(() => {
    const option = this.option();
    if (option && this.imageRecovery.pending(option)) this.imageRefreshError.set(null);
  });
  readonly imageRecoveryBlocked = computed(() => this.editingBasic() || this.editingAttributes() ||
    this.refreshingImage() || this.savingBasic() || !!this.scoreForm()?.expandedCommentCriterionId());

  refreshImage(replaceThumbnail = false): void {
    const option = this.option();
    const decisionId = this.decisionId;
    if (!option || !decisionId || !this.canRefreshImage() || this.imageRecoveryBlocked()) return;
    if (!replaceThumbnail && this.imageRecovery.needsConfirmation(option)) {
      this.confirmImageReplacement.set(true);
      return;
    }
    this.imageRefreshError.set(null);
    this.confirmImageReplacement.set(false);
    this.imageRecovery.refresh(option, replaceThumbnail)
      .subscribe({
        error: error => {
          if (this.optionId !== option.id) return;
          if (error.error?.code === 'thumbnail_confirmation_required')
            this.confirmImageReplacement.set(true);
          this.imageRefreshError.set(error.error?.message ?? 'Unable to refresh the image. Please try again.');
        },
      });
  }

  readonly showMoreScores =
    signal(false);

  readonly showMoreAttributes =
    signal(false);

  readonly formHydrated =
    signal(false);

  readonly deleting =
    signal(false);


  readonly option = computed(() => {

    if (!this.optionId || this.decisionState.decisionId() !== this.decisionId ||
      this.decisionState.loadStatus() !== 'loaded') {
      return null;
    }

    return (
      this.decisionState
        .options()
        .find(
          option =>
            option.id ===
            this.optionId && option.decisionId === this.decisionId,
        ) ??
      null
    );

  });


  readonly loadMessage = computed(() => {
    if (!this.decisionId || !this.optionId) return 'This option URL is incomplete.';
    if (this.decisionState.decisionId() !== this.decisionId) return null;
    if (this.decisionState.loadStatus() === 'error') {
      return this.decisionState.loadErrorStatus() === 404
        ? 'This decision was not found or is no longer available.'
        : 'Unable to load this option. Please try again.';
    }
    if (this.decisionState.loadStatus() === 'loaded' && !this.option())
      return 'This option was not found or is no longer available.';
    return null;
  });

  retryLoad(): void {
    if (!this.decisionId) return;
    this.decisionState.invalidateDecision(this.decisionId);
    this.decisionState.ensureDecisionLoaded(this.decisionId);
  }

  readonly attributes = computed(() => {

    if (!this.optionId) {
      return [];
    }

    return (
      this.decisionState
        .optionAttributes()[
          this.optionId
        ] ?? []
    );

  });


  readonly scores = computed(() => {

    if (!this.optionId) {
      return [];
    }

    return (
      this.decisionState
        .optionScores()[
          this.optionId
        ] ?? []
    );

  });


  readonly criteria =
    this.decisionState.criteria;


  readonly visibleAttributes =
    computed(() => {

      const attributes =
        this.attributes();

      return this.showMoreAttributes()
        ? attributes
        : attributes.slice(0, 5);

    });


  readonly weightedScore =
    computed(() => {

      const scores =
        this.scores();

      if (
        scores.length === 0
      ) {
        return null;
      }

      let weightedTotal = 0;
      let totalImportance = 0;

      for (
        const optionScore
        of scores
      ) {

        const criterion =
          this.criteria().find(
            criterion =>
              criterion.id ===
              optionScore.criterionId,
          );

        if (!criterion) {
          continue;
        }

        weightedTotal +=
          optionScore.score *
          criterion.importance;

        totalImportance +=
          criterion.importance;
      }

      if (
        totalImportance === 0
      ) {
        return null;
      }

      return (
        weightedTotal /
        totalImportance
      );

    });


  private hydratedOptionId:
    string | null = null;

  private resetOptionId:
    string | null = null;

  private scrolledOptionId:
    string | null = null;


  private readonly resetTransientUi =
    effect(() => {

      const optionId =
        this.optionId;

      if (
        !optionId ||
        this.resetOptionId ===
          optionId
      ) {
        return;
      }

      this.resetOptionId =
        optionId;

      this.imageRefreshError.set(null);
      this.confirmImageReplacement.set(false);
      this.basicSaveError.set(null);

      this.editingAttributes
        .set(false);

      this.editingBasic
        .set(false);

      this.showMoreScores
        .set(false);

      this.showMoreAttributes
        .set(false);

      this.deleting
        .set(false);

    });


  private readonly resetScrollPosition =
    effect(() => {

      const optionId =
        this.optionId;

      const content =
        this.content();

      if (
        !optionId ||
        !content ||
        this.scrolledOptionId ===
          optionId
      ) {
        return;
      }

      this.scrolledOptionId =
        optionId;

      void content.scrollToTop(0);

    });


  private readonly hydrateForm =
    effect(() => {

      const option =
        this.option();

      const loadStatus =
        this.decisionState
          .loadStatus();

      if (
        !option ||
        loadStatus !==
          'loaded' ||
        this.hydratedOptionId ===
          option.id
      ) {
        return;
      }


      this.optionForm.patchValue({
        title:
          option.title,

        url:
          option.url ??
          '',

        thumbnailUrl:
          option.thumbnailUrl ??
          '',

        description:
          option.description ??
          '',

        price:
          option.price ??
          null,

        currency:
          option.currency ??
          'IDR',
      });


      const attributeArray =
        this.optionForm.controls
          .attributes;

      attributeArray.clear();


      for (
        const attribute
        of this.attributes()
      ) {

        attributeArray.push(

          new FormGroup({

            name:
              new FormControl(
                attribute.name,
                {
                  nonNullable:
                    true,
                },
              ),

            value:
              new FormControl(
                attribute.value,
                {
                  nonNullable:
                    true,
                },
              ),

          }) as AttributeFormGroup,

        );

      }


      const scoreArray =
        this.optionForm.controls
          .scores;


      for (
        const criterion
        of this.criteria()
      ) {

        const persistedScore =
          this.scores().find(
            score =>
              score.criterionId ===
              criterion.id,
          );


        const existingForm =
          scoreArray.controls.find(
            scoreGroup =>
              scoreGroup.controls
                .criterionId
                .value ===
              criterion.id,
          );


        if (existingForm) {

          existingForm.patchValue({

            score:
              persistedScore
                ?.score ??
              null,

            comment:
              persistedScore
                ?.comment ??
              '',

          });

          continue;

        }


        scoreArray.push(

          new FormGroup({

            criterionId:
              new FormControl(
                criterion.id,
                {
                  nonNullable:
                    true,
                },
              ),

            score:
              new FormControl<
                number | null
              >(
                persistedScore
                  ?.score ??
                null,
              ),

            comment:
              new FormControl(
                persistedScore
                  ?.comment ??
                '',
                {
                  nonNullable:
                    true,
                },
              ),

          }) as ScoreFormGroup,

        );

      }


      this.hydratedOptionId =
        option.id;

      this.formHydrated.set(
        true,
      );

    });


  ionViewWillEnter(): void {

    if (!this.decisionId) {
      return;
    }

    this.decisionState
      .ensureDecisionLoaded(
        this.decisionId,
      );

  }


  async backToDecision(): Promise<void> {
    if (!await this.canLeave()) return;

    if (
      this.presentation() ===
      'panel'
    ) {

      this.closeRequested
        .emit();

      return;

    }

    if (!this.decisionId) {
      return;
    }

    this.navController
      .navigateBack([
        '/decisions',
        this.decisionId,
      ]);

  }


  toggleAttributesEdit(): void {

    if (this.refreshingImage() || this.savingBasic()) return;
    if (this.savingAttributes()) return;
    if (!this.editingAttributes()) {
      const controls = this.optionForm.controls.attributes;
      controls.clear();
      for (const attribute of this.attributes()) {
        controls.push(new FormGroup({
          name: new FormControl(attribute.name, { nonNullable: true }),
          value: new FormControl(attribute.value, { nonNullable: true }),
        }));
      }
      this.attributeEditBaseline = JSON.stringify(controls.getRawValue());
    }

    this.editingAttributes
      .update(
        value => !value,
      );

  }


  toggleBasicEdit(): void {

    if (this.refreshingImage() || this.savingBasic()) return;
    if (!this.editingBasic()) {
      const option = this.option();
      if (!option) return;
      this.basicEditVersion = option.updatedAt;
      // Recovery may have changed the image since the initial form hydration.
      this.optionForm.patchValue({
        title: option.title, url: option.url ?? '', thumbnailUrl: option.thumbnailUrl ?? '',
        description: option.description ?? '', price: option.price ?? null, currency: option.currency ?? 'IDR',
      });
      this.basicEditBaseline = this.basicValues();
    }
    this.basicSaveError.set(null);

    this.editingBasic
      .update(
        value => !value,
      );

  }


  saveAttributes(): void {
    if (this.savingAttributes()) return;

    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }


    const requests =
      this.optionForm
        .controls
        .attributes
        .controls
        .map(attribute => {

          const value =
            attribute
              .getRawValue();

          return {

            name:
              value.name
                .trim(),

            value:
              value.value
                .trim(),

          };

        })
        .filter(
          attribute =>
            attribute.name &&
            attribute.value,
        );


    this.savingAttributes.set(true);
    const accountVersion = this.decisionState.accountVersion();
    const optionId = this.optionId;
    this.decisionApi
      .updateDecisionOptionAttributes(
        this.decisionId,
        this.optionId,
        requests,
      )
      .pipe(
        filter(() => accountVersion === this.decisionState.accountVersion() && optionId === this.optionId),
        finalize(() => this.savingAttributes.set(false)),
      )
      .subscribe({

        next:
          updatedAttributes => {

            this.decisionState
              .updateOptionAttributes(
                this.optionId!,
                updatedAttributes,
              );

            this.editingAttributes
              .set(false);

          },

        error:
          error => {

            console.error(
              'Failed to save attributes:',
              error,
            );

          },

      });

  }


  saveBasicDetails(): void {

    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }


    if (
      this.optionForm
        .controls
        .title
        .invalid
    ) {

      this.optionForm
        .controls
        .title
        .markAsTouched();

      return;

    }


    const value =
      this.optionForm
        .getRawValue();


    if (this.savingBasic() || this.refreshingImage()) return;
    this.savingBasic.set(true);
    const accountVersion = this.decisionState.accountVersion();
    const optionId = this.optionId;
    this.decisionApi
      .updateDecisionOption(
        this.decisionId,
        this.optionId,
        {

          expectedUpdatedAt: this.basicEditVersion,

          title:
            value.title
              .trim(),

          url:
            value.url
              .trim() ||
            undefined,

          thumbnailUrl:
            value.thumbnailUrl
              .trim() ||
            undefined,

          description:
            value.description
              .trim() ||
            undefined,

          price:
            value.price ??
            undefined,

          currency:
            value.currency ||
            undefined,

          attributes: [],

          scores: [],

        },
      )
      .pipe(
        filter(() => accountVersion === this.decisionState.accountVersion() && optionId === this.optionId),
        finalize(() => this.savingBasic.set(false)),
      )
      .subscribe({

        next:
          updatedOption => {

            this.savingBasic.set(false);

            this.decisionState
              .updateOption(
                updatedOption,
              );

            this.editingBasic
              .set(false);

            this.basicSaveError.set(null);

          },

        error:
          error => {

            console.error(
              'Failed to update option:',
              error,
            );

            this.savingBasic.set(false);

            this.basicSaveError.set(error.error?.message ?? 'Unable to save changes. Please try again.');

          },

      });

  }


  saveScore(
    event: {
      criterionId: string;
      score: number;
      comment: string;
    },
  ): void {

    if (!this.optionId) {
      return;
    }


    this.pendingScoreSaves.update(count => count + 1);
    const accountVersion = this.decisionState.accountVersion();
    const optionId = this.optionId;
    this.decisionApi
      .createOptionScore(
        this.optionId,
        {

          criterionId:
            event.criterionId,

          score:
            event.score,

          comment:
            event.comment ||
            undefined,

        },
      )
      .pipe(
        filter(() => accountVersion === this.decisionState.accountVersion() && optionId === this.optionId),
        finalize(() => this.pendingScoreSaves.update(count => count - 1)),
      )
      .subscribe({

        next:
          updatedScore => {

            this.decisionState
              .updateOptionScore(
                this.optionId!,
                updatedScore,
              );

          },

        error:
          error => {

            console.error(
              'Failed to save score:',
              error,
            );

          },

      });

  }


  removeOption(): void {

    if (
      !this.decisionId ||
      !this.optionId
    ) {
      return;
    }


    this.deleting.set(
      true,
    );


    this.decisionApi
      .deleteDecisionOption(
        this.decisionId,
        this.optionId,
      )
      .subscribe({

        next: () => {

          this.decisionState
            .removeOption(
              this.optionId!,
            );


          if (
            this.presentation() ===
            'panel'
          ) {

            this.closeRequested
              .emit();

            return;

          }


          this.navController
            .navigateBack([
              '/decisions',
              this.decisionId,
            ]);

        },

        error:
          error => {

            console.error(
              'Failed to delete option:',
              error,
            );

            this.deleting
              .set(false);

          },

      });

  }

}
