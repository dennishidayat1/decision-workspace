export interface DecisionOption {
  id: string;
  title: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  price?: number;
  currency?: string;
}