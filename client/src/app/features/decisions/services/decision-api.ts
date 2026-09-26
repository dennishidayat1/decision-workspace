import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDecisionRequest } from '../models/create-decision-request';
import { Decision } from '../models/decision';
import { environment } from '../../../../environments/environment';
import { DecisionOption } from '../models/decision-option';
import { CreateDecisionOptionRequest } from '../models/create-decision-option-request';
import { CreateDecisionOptionAttributeRequest } from '../models/create-decision-option-attribute-request';
import { DecisionOptionAttribute } from '../models/decision-option-attribute';
import { CreateCriterionRequest } from '../models/create-criterion-request';
import { Criterion } from '../models/criterion';
import { CreateOptionScoreRequest } from '../models/create-option-score-request';
import { OptionScore } from '../models/option-score';

@Service()
export class DecisionApi {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}`;
  
  createDecision(request: CreateDecisionRequest) {
    return this.http.post<Decision>(
      `${this.apiUrl}/decisions`,
      request,
    );
  }

  getAllDecisions() {
    return this.http.get<Decision[]>(
      `${this.apiUrl}/decisions`,
    );
  }
  getDecisionById(id: string) {
    return this.http.get<Decision>(
      `${this.apiUrl}/decisions/${id}`,
    );
  }

  getDecisionOptions(decisionId: string) {
    return this.http.get<DecisionOption[]>(
      `${this.apiUrl}/decisions/${decisionId}/options`,
    );
  }

  createDecisionOption(decisionId: string, request: CreateDecisionOptionRequest) {
    return this.http.post<DecisionOption>(
      `${this.apiUrl}/decisions/${decisionId}/options`,
      request,
    );
  }

  getDecisionOptionAttributes(decisionId: string, decisionOptionId: string) {
    return this.http.get<DecisionOptionAttribute[]>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}/attributes`,
    );
  }

  createDecisionOptionAttribute(decisionId: string, decisionOptionId: string, request: CreateDecisionOptionAttributeRequest) {
    return this.http.post<DecisionOptionAttribute>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}/attributes`,
      request,
    );
  }

  getCriteria(decisionId: string) {
    return this.http.get<Criterion[]>(
      `${this.apiUrl}/decisions/${decisionId}/criteria`,
    );
  }

  createCriterion(decisionId: string, request: CreateCriterionRequest) {
    return this.http.post<Criterion>(
      `${this.apiUrl}/decisions/${decisionId}/criteria`,
      request,
    );
  }
  
  getOptionScores(decisionOptionId: string) {
    return this.http.get<OptionScore[]>(
      `${this.apiUrl}/decision-options/${decisionOptionId}/scores`
    )
  }

  createOptionScore(decisionOptionId: string, request: CreateOptionScoreRequest) {
    return this.http.post<OptionScore>(
      `${this.apiUrl}/decision-options/${decisionOptionId}/scores`,
      request
    )
  }
}
