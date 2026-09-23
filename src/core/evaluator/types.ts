export interface EvaluatorUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export interface SystemOneAnswers {
  prompt_injection: NoulAnswer;
  toxicity: NoulAnswer;
  pii_leak: NoulAnswer;
  department: ChoiceAnswer;
  severity: ScoreAnswer;
  sentiment: ScoreAnswer;
  is_actionable: NoulAnswer;
  [key: string]: any;
}

export interface EvaluatorResult {
  latencyMs: number;
  model: string;
  usage: EvaluatorUsage;
  answers: SystemOneAnswers;
}

export interface ITypeSafeEvaluator {
  evaluate(state: string | Record<string, any>): Promise<EvaluatorResult>;
}
