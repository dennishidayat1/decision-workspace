import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDecisionRequest } from '../models/create-decision-request';
import { Decision } from '../models/decision';

@Service()
export class DecisionApi {
  private readonly http = inject(HttpClient);
  createDecision(request: CreateDecisionRequest) {
    return this.http.post<Decision>(
      'http://localhost:5207/api/decisions',
      request,
    );
  }
}
