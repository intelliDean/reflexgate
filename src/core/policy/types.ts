import { 
  TriageAction, 
  Department, 
  GuardrailResults 
} from '../types.js';
import { GatewayPolicyConfig } from '../config.js';

export type PriorityLevel = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_NORMAL' | 'P4_LOW';

export interface ExtractedSignals {
  promptInjection: number;
  toxicity: number;
  piiLeak: number;
  guardrails: GuardrailResults;
  selectedDept: Department;
  deptConfidence: number;
  deptProbabilities: Record<Department, number>;
  severityScore: number;
  severityConfidence: number;
  severityLevelLabel: string;
  severityProbabilities: Record<string, number>;
  sentimentScore: number;
  sentimentConfidence: number;
  sentimentLevelLabel: string;
  sentimentProbabilities: Record<string, number>;
  isActionable: number;
  compositeRiskScore: number;
}

export interface RuleEvaluationResult {
  action: TriageAction;
  targetQueue: string;
  priority: PriorityLevel;
  summaryReason: string;
  routingTags: string[];
}

export interface PolicyRule {
  name: string;
  evaluate(signals: ExtractedSignals, config: GatewayPolicyConfig): RuleEvaluationResult | null;
}
