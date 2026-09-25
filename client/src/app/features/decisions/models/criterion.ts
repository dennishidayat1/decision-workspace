export interface Criterion {
  id: string;
  decisionId: string;
  name: string;
  importance: number;
  context: string | null;
  createdAt: string;
  updatedAt: string;
}