export interface DecisionOption {
  id: string;
  decisionId: string;
  title: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  price?: number;
  currency?: string;
  sourceUrl?: string;
  sourceName?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}