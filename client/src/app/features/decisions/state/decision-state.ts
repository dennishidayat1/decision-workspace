import { computed, inject, Injectable, signal } from '@angular/core';
import { DecisionOption } from '../models/decision-option';
import { DecisionOptionAttribute } from '../models/decision-option-attribute';
import { Criterion } from '../models/criterion';
import { OptionScore } from '../models/option-score';
import { DecisionApi } from '../services/decision-api';
import { Decision } from '../models/decision';

@Injectable({
    providedIn: 'root',
})
export class DecisionState {
    private readonly decisionApi = inject(DecisionApi);
    readonly decision = signal<Decision | null>(null);
    readonly options = signal<DecisionOption[]>([]);
    readonly criteria = signal<Criterion[]>([]);
    readonly optionScores = signal<Record<string, OptionScore[]>>({});
    readonly optionAttributes = signal<Record<string, DecisionOptionAttribute[]>>({});
    readonly decisionId = signal<string | null>(null);
    readonly loadStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    readonly loadErrorStatus = signal<number | null>(null);
    private loadRequestVersion = 0;
    // Shared image-recovery lifecycle across cards, list rows, and detail panels.
    readonly workspaceLoadVersion = signal(0);
    // Changes only when the workspace is reset, not on ordinary reloads.
    readonly accountVersion = signal(0);

    readonly availableAttributeNames = computed(() => {
        const attributesByOption = this.optionAttributes();

        const names = Object.values(attributesByOption)
            .flat()
            .map((attribute) => attribute.name);

        return [...new Set(names)];
    });


    ensureDecisionLoaded(decisionId: string): void {
        const isSameDecision = this.decisionId() === decisionId;

        if (
            isSameDecision &&
            (
                this.loadStatus() === 'loaded' ||
                this.loadStatus() === 'loading'
            )
        ) {
            return;
        }

        if (!isSameDecision) {
            this.decision.set(null);
            this.options.set([]);
            this.optionAttributes.set({});
            this.criteria.set([]);
            this.optionScores.set({});
        }

        this.decisionId.set(decisionId);
        const requestVersion = ++this.loadRequestVersion;
        this.workspaceLoadVersion.update(version => version + 1);
        this.loadErrorStatus.set(null);
        this.loadStatus.set('loading');

        this.decisionApi
            .getDecisionWorkspace(decisionId)
            .subscribe({
                next: (workspace) => {
                    if (requestVersion !== this.loadRequestVersion) return;
                    const attributesByOption =
                        Object.fromEntries(
                            workspace.options.map(option => [
                                option.id,
                                workspace.attributes.filter(
                                    attribute =>
                                        attribute.decisionOptionId ===
                                        option.id,
                                ),
                            ]),
                        );

                    const scoresByOption =
                        Object.fromEntries(
                            workspace.options.map(option => [
                                option.id,
                                workspace.scores.filter(
                                    score =>
                                        score.decisionOptionId ===
                                        option.id,
                                ),
                            ]),
                        );

                    this.decision.set(workspace.decision);
                    this.options.set(workspace.options);
                    this.criteria.set(workspace.criteria);

                    this.optionAttributes.set(
                        attributesByOption,
                    );

                    this.optionScores.set(
                        scoresByOption,
                    );

                    this.loadStatus.set('loaded');
                },

                error: (error) => {
                    if (requestVersion !== this.loadRequestVersion) return;
                    this.loadErrorStatus.set(error.status ?? null);
                    console.error(
                        'Failed to load decision workspace:',
                        error,
                    );

                    this.loadStatus.set('error');
                },
            });
    }

    invalidateDecision(decisionId: string): void {
        if (this.decisionId() === decisionId) {
            this.loadRequestVersion++;
            this.loadStatus.set('idle');
        }
    }

    updateOption(updatedOption: DecisionOption): void {
        this.options.update(options =>
            options.map(option =>
                option.id === updatedOption.id
                    ? updatedOption
                    : option,
            ),
        );
    }

    updateOptionScore(
        decisionOptionId: string,
        updatedScore: OptionScore,
    ): void {
        this.optionScores.update(scoresByOption => {
            const currentScores =
                scoresByOption[decisionOptionId] ?? [];

            const existingIndex =
                currentScores.findIndex(
                    score =>
                        score.criterionId ===
                        updatedScore.criterionId,
                );

            const updatedScores =
                existingIndex >= 0
                    ? currentScores.map(score =>
                        score.criterionId ===
                            updatedScore.criterionId
                            ? updatedScore
                            : score,
                    )
                    : [
                        ...currentScores,
                        updatedScore,
                    ];

            return {
                ...scoresByOption,
                [decisionOptionId]: updatedScores,
            };
        });
    }

    updateOptionAttributes(
        decisionOptionId: string,
        updatedAttributes: DecisionOptionAttribute[],
    ): void {
        this.optionAttributes.update(
            attributesByOption => ({
                ...attributesByOption,
                [decisionOptionId]: updatedAttributes,
            }),
        );
    }

    removeOption(
        decisionOptionId: string,
    ): void {
        this.options.update(options =>
            options.filter(
                option =>
                    option.id !== decisionOptionId,
            ),
        );

        this.optionAttributes.update(
            attributesByOption => {
                const updated = {
                    ...attributesByOption,
                };

                delete updated[decisionOptionId];

                return updated;
            },
        );

        this.optionScores.update(
            scoresByOption => {
                const updated = {
                    ...scoresByOption,
                };

                delete updated[decisionOptionId];

                return updated;
            },
        );
    }

    resetWorkspace(): void {
        this.accountVersion.update(version => version + 1);
        this.decision.set(null);
        this.options.set([]);
        this.criteria.set([]);
        this.optionScores.set({});
        this.optionAttributes.set({});
        this.decisionId.set(null);
        this.loadStatus.set('idle');
        this.loadErrorStatus.set(null);

        this.loadRequestVersion++;
        this.workspaceLoadVersion.update(version => version + 1);
    }
}
