import { EvaluatorResult, SystemOneAnswers } from './types.js';

export function normalizeEvaluatorResponse(
  raw: any,
  latencyMs: number
): EvaluatorResult {
  const model = raw.model || 'jev-latest';
  const inputTokens = raw.usage?.input_tokens ?? raw.usage?.inputTokens ?? 0;
  const outputTokens = raw.usage?.output_tokens ?? raw.usage?.outputTokens ?? 0;
  const answers = (raw.answers || {}) as SystemOneAnswers;

  return {
    latencyMs,
    model,
    usage: {
      inputTokens,
      outputTokens
    },
    answers
  };
}
