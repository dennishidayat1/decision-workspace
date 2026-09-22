export interface Decision {
  id: string;
  title: string;
  question: string;
  context?: string;
  category?: string;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export type DecisionStatus =
  | 'draft'
  | 'researching'
  | 'comparing'
  | 'decided'
  | 'archived';