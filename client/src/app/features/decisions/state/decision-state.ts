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
        const isSameDecision = this.decisionId() === decisionId;

        if (
            isSameDecision &&
            (this.loadStatus() === 'loaded' ||
                this.loadStatus() === 'loading')
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
            options: this.decisionApi.getDecisionOptions(decisionId),
            criteria: this.decisionApi.getCriteria(decisionId),
        }).subscribe({
            next: ({ options, criteria }) => {
                this.options.set(options);
                this.criteria.set(criteria);

                if (options.length === 0) {
                    this.optionAttributes.set({});
                    this.optionScores.set({});
                    this.loadStatus.set('loaded');
                    return;
                }

                const attributeRequests = options.map((option) =>
                    this.decisionApi.getDecisionOptionAttributes(
                        decisionId,
                        option.id,
                    ),
                );

                const scoreRequests = options.map((option) =>
                    this.decisionApi.getOptionScores(option.id),
                );

                forkJoin({
                    attributeResults: forkJoin(attributeRequests),
                    scoreResults: forkJoin(scoreRequests),
                }).subscribe({
                    next: ({
                        attributeResults,
                        scoreResults
                    }) => {
                        const attributesByOption = Object.fromEntries(
                            options.map((option, index) => [
                                option.id,
                                attributeResults[index],
                            ]),
                        );

                        const scoresByOption = Object.fromEntries(
                            options.map((option, index) => [
                                option.id,
                                scoreResults[index],
                            ]),
                        );

                        this.optionAttributes.set(attributesByOption);
                        this.optionScores.set(scoresByOption)
                        this.loadStatus.set('loaded');
                    },
                    error: (error) => {
                        console.error('Failed to load option attributes:', error);
                        this.loadStatus.set('error');
                    },
                });
            },
            error: (error) => {
                console.error('Failed to load option attributes:', error);
                this.loadStatus.set('error');
            },
        });
    }

    invalidateDecision(decisionId: string): void {
        if (this.decisionId() === decisionId) {
            this.loadStatus.set('idle');
        }
    }
}
