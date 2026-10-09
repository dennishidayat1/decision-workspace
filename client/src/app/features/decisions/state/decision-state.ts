import { computed, inject, Injectable, signal } from '@angular/core';
import { DecisionOption } from '../models/decision-option';
import { DecisionOptionAttribute } from '../models/decision-option-attribute';
import { Criterion } from '../models/criterion';
import { OptionScore } from '../models/option-score';
import { DecisionApi } from '../services/decision-api';
import { forkJoin } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class DecisionState {
    private readonly decisionApi = inject(DecisionApi);
    readonly options = signal<DecisionOption[]>([]);
    readonly criteria = signal<Criterion[]>([]);
    readonly optionScores = signal<Record<string, OptionScore[]>>({});
    readonly optionAttributes = signal<Record<string, DecisionOptionAttribute[]>>({});
    readonly decisionId = signal<string | null>(null);
    readonly loadStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');

    readonly availableAttributeNames = computed(() => {
        const attributesByOption = this.optionAttributes();

        const names = Object.values(attributesByOption)
            .flat()
            .map((attribute) => attribute.name);

        return [...new Set(names)];
    });


    ensureDecisionLoaded(decisionId: string): void {
        const isSameDecision =
            this.decisionId() === decisionId;

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
            this.options.set([]);
            this.optionAttributes.set({});
            this.criteria.set([]);
            this.optionScores.set({});
        }

        this.decisionId.set(decisionId);
        this.loadStatus.set('loading');

        forkJoin({
            options:
                this.decisionApi.getDecisionOptions(
                    decisionId,
                ),
            criteria:
                this.decisionApi.getCriteria(
                    decisionId,
                ),
        }).subscribe({
            next: ({ options, criteria }) => {

                if (options.length === 0) {
                    this.options.set(options);
                    this.criteria.set(criteria);
                    this.optionAttributes.set({});
                    this.optionScores.set({});
                    this.loadStatus.set('loaded');

                    return;
                }

                const attributeRequests =
                    options.map(option =>
                        this.decisionApi
                            .getDecisionOptionAttributes(
                                decisionId,
                                option.id,
                            ),
                    );

                const scoreRequests =
                    options.map(option =>
                        this.decisionApi
                            .getOptionScores(option.id),
                    );

                forkJoin({
                    attributeResults:
                        forkJoin(attributeRequests),

                    scoreResults:
                        forkJoin(scoreRequests),
                }).subscribe({
                    next: ({
                        attributeResults,
                        scoreResults,
                    }) => {

                        const attributesByOption =
                            Object.fromEntries(
                                options.map(
                                    (option, index) => [
                                        option.id,
                                        attributeResults[index],
                                    ],
                                ),
                            );

                        const scoresByOption =
                            Object.fromEntries(
                                options.map(
                                    (option, index) => [
                                        option.id,
                                        scoreResults[index],
                                    ],
                                ),
                            );

                        this.options.set(options);
                        this.criteria.set(criteria);
                        this.optionAttributes.set(
                            attributesByOption,
                        );
                        this.optionScores.set(
                            scoresByOption,
                        );

                        this.loadStatus.set('loaded');
                    },

                    error: (error) => {
                        console.error(
                            'Failed to load option details:',
                            error,
                        );

                        this.loadStatus.set('error');
                    },
                });
            },

            error: (error) => {
                console.error(
                    'Failed to load decision:',
                    error,
                );

                this.loadStatus.set('error');
            },
        });
    }

    invalidateDecision(decisionId: string): void {
        if (this.decisionId() === decisionId) {
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
}
