import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDecisionRequest } from '../models/create-decision-request';
import { Decision } from '../models/decision';
import { environment } from '../../../../environments/environment';
import { DecisionOption } from '../models/decision-option';
import { CreateDecisionOptionRequest } from '../models/create-decision-option-request';
import { CreateDecisionOptionAttributeRequest } from '../models/create-decision-option-attribute-request';
import { DecisionOptionAttribute } from '../models/decision-option-attribute';

@Service()
export class DecisionApi {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/decisions`;
  
  createDecision(request: CreateDecisionRequest) {
    return this.http.post<Decision>(
      this.apiUrl,
      request,
    );
  }

  getAllDecisions() {
    return this.http.get<Decision[]>(
      this.apiUrl,
    );
  }
  getDecisionById(id: string) {
    return this.http.get<Decision>(
      `${this.apiUrl}/${id}`,
    );
  }

  getDecisionOptions(decisionId: string) {
    return this.http.get<DecisionOption[]>(
      `${this.apiUrl}/${decisionId}/options`,
    );
  }

  createDecisionOption(decisionId: string, request: CreateDecisionOptionRequest) {
    return this.http.post<DecisionOption>(
      `${this.apiUrl}/${decisionId}/options`,
      request,
    );
  }

  getDecisionOptionAttributes(decisionId: string, decisionOptionId: string) {
    return this.http.get<DecisionOptionAttribute[]>(
      `${this.apiUrl}/${decisionId}/options/${decisionOptionId}/attributes`,
    );
  }

  createDecisionOptionAttribute(decisionId: string, decisionOptionId: string, request: CreateDecisionOptionAttributeRequest) {
    return this.http.post<DecisionOptionAttribute>(
      `${this.apiUrl}/${decisionId}/options/${decisionOptionId}/attributes`,
      request,
    );
  }
}
