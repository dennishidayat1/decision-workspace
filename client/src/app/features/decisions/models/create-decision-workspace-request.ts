import { CreateCriterionRequest } from './create-criterion-request';

export interface CreateDecisionWorkspaceRequest {
  title: string;
  question: string;
  category?: string;
  context?: string;
  criteria: CreateCriterionRequest[];
}