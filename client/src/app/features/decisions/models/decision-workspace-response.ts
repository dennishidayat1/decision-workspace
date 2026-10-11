import { Decision } from './decision';
import { DecisionOption } from './decision-option';
import { DecisionOptionAttribute } from './decision-option-attribute';
import { Criterion } from './criterion';
import { OptionScore } from './option-score';

export interface DecisionWorkspaceResponse {
  decision: Decision;
  options: DecisionOption[];
  criteria: Criterion[];
  attributes: DecisionOptionAttribute[];
  scores: OptionScore[];
}