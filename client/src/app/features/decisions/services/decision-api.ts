import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDecisionRequest } from '../models/create-decision-request';
import { Decision } from '../models/decision';
import { environment } from '../../../../environments/environment';

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
}
