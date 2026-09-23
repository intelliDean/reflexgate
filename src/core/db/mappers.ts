import { GatewayDecision } from '../types.js';

export function createContentSnippet(
  rawContent: string | Record<string, any>, 
  maxLength: number = 300
): string {
  const text = typeof rawContent === 'string' 
    ? rawContent 
    : JSON.stringify(rawContent);
  return text.slice(0, maxLength);
}

export function mapDecisionToRowParams(
  decision: GatewayDecision, 
  rawContent: string | Record<string, any>
): (string | number)[] {
  const contentSnippet = createContentSnippet(rawContent);

  return [
    decision.requestId,
    decision.source,
    decision.receivedAt,
    decision.evaluatedAt,
    decision.latencyMs,
    decision.tokenUsage.inputTokens,
    decision.tokenUsage.outputTokens,
    decision.verdict.action,
    decision.verdict.targetQueue,
    decision.verdict.priority,
    decision.verdict.compositeRiskScore,
    decision.verdict.summaryReason,
    contentSnippet,
    JSON.stringify(decision),
    decision.classification.selected,
    decision.classification.confidence,
    decision.severity.score,
    decision.sentiment.score,
    decision.guardrails.isSafe ? 1 : 0
  ];
}

export function parseDecisionFromRow(row: { full_decision_json: string }): GatewayDecision {
  return JSON.parse(row.full_decision_json) as GatewayDecision;
}
