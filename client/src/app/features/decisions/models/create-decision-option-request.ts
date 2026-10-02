import { CreateDecisionOptionAttributeRequest } from './create-decision-option-attribute-request'
import { CreateOptionScoreRequest } from './create-option-score-request';

export interface CreateDecisionOptionRequest {
  title: string;
  url?: string;
  thumbnailUrl?: string;
  description?: string;
  price?: number;
  currency?: string;

  attributes: CreateDecisionOptionAttributeRequest[];
  scores: CreateOptionScoreRequest[];
}