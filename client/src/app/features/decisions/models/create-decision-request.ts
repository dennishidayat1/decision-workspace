export interface CreateDecisionRequest {
  title: string;
  question: string;
  context?: string;
  category?: string;
}