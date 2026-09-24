export interface DecisionOption {
  id: string;
  decisionId: string;
  title: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  price?: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}