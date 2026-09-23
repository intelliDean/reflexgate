import { 
  TriageRequestPayload, 
  GatewayDecision, 
  Department, 
  GuardrailResults 
} from '../types.js';
import { EvaluatorResult } from '../evaluator.js';
import { GatewayPolicyConfig, DEFAULT_POLICY_CONFIG } from '../config.js';
import { PolicyRule, ExtractedSignals, RuleEvaluationResult } from './types.js';
import { GuardrailRule } from './rules/guardrail.js';
import { CriticalSlaRule } from './rules/critical_sla.js';
import { ConfidenceGateRule } from './rules/confidence_gate.js';
import { AutoDispatchRule } from './rules/auto_dispatch.js';

export class PolicyEngine {
  private readonly rules: PolicyRule[];

  constructor(customRules?: PolicyRule[]) {
    this.rules = customRules || [
      new GuardrailRule(),
      new CriticalSlaRule(),
      new ConfidenceGateRule(),
      new AutoDispatchRule()
    ];
  }

  /**
   * Extracts clean, structured signals from raw System One answers.
   */
  public extractSignals(result: EvaluatorResult, config: GatewayPolicyConfig): ExtractedSignals {
    const { answers } = result;

    const promptInjection = answers.prompt_injection?.noul ?? 0.0;
    const toxicity = answers.toxicity?.noul ?? 0.0;
    const piiLeak = answers.pii_leak?.noul ?? 0.0;

    const violations: string[] = [];
    if (promptInjection >= config.promptInjectionThreshold) {
      const actual = (promptInjection * 100).toFixed(0);
      const threshold = (config.promptInjectionThreshold * 100).toFixed(0);
      violations.push(`Prompt Injection / Jailbreak Attempt detected (${actual}% >= ${threshold}%)`);
    }
    if (toxicity >= config.toxicityThreshold) {
      const actual = (toxicity * 100).toFixed(0);
      const threshold = (config.toxicityThreshold * 100).toFixed(0);
      violations.push(`Severe Toxicity / Harassment detected (${actual}% >= ${threshold}%)`);
    }
    if (piiLeak >= config.piiLeakThreshold) {
      const actual = (piiLeak * 100).toFixed(0);
      const threshold = (config.piiLeakThreshold * 100).toFixed(0);
      violations.push(`Unsafe Credential / PII Exposure detected (${actual}% >= ${threshold}%)`);
    }

    const guardrails: GuardrailResults = {
      promptInjectionRisk: promptInjection,
      toxicityRisk: toxicity,
      piiLeakRisk: piiLeak,
      isSafe: violations.length === 0,
      violations
    };

    const selectedDept = (answers.department?.choice as Department) || 'general_feedback';
    const deptConfidence = answers.department?.confidence ?? 0.0;
    const deptProbabilities = (answers.department?.probabilities as Record<Department, number>) || {};

    const severityScore = answers.severity?.score ?? 0.0;
    const severityConfidence = answers.severity?.confidence ?? 1.0;
    const severityLegend = answers.severity?.legend || {};
    const severityProbabilities = answers.severity?.probabilities || {};
    const severityLevelLabel = severityLegend[Math.round(severityScore).toString()] || 'Normal';

    const sentimentScore = answers.sentiment?.score ?? 0.0;
    const sentimentConfidence = answers.sentiment?.confidence ?? 1.0;
    const sentimentLegend = answers.sentiment?.legend || {};
    const sentimentProbabilities = answers.sentiment?.probabilities || {};
    const sentimentLevelLabel = sentimentLegend[Math.round(sentimentScore).toString()] || 'Neutral';

    const isActionable = answers.is_actionable?.noul ?? 1.0;

    const compositeRiskScore = Math.min(100, Math.round(
      (promptInjection * 40) +
      (toxicity * 25) +
      (piiLeak * 15) +
      ((severityScore / 3.0) * 12) +
      ((sentimentScore / 3.0) * 8)
    ));

    return {
      promptInjection,
      toxicity,
      piiLeak,
      guardrails,
      selectedDept,
      deptConfidence,
      deptProbabilities,
      severityScore,
      severityConfidence,
      severityLevelLabel,
      severityProbabilities,
      sentimentScore,
      sentimentConfidence,
      sentimentLevelLabel,
      sentimentProbabilities,
      isActionable,
      compositeRiskScore
    };
  }

  /**
   * Applies the rule chain to the extracted signals.
   */
  public evaluateRules(signals: ExtractedSignals, config: GatewayPolicyConfig): RuleEvaluationResult {
    for (const rule of this.rules) {
      const result = rule.evaluate(signals, config);
      if (result) {
        return result;
      }
    }

    // Default fallback
    return {
      action: 'HUMAN_REVIEW',
      targetQueue: 'triage:default',
      priority: 'P3_NORMAL',
      summaryReason: 'No specific policy rule matched; routed to human review by default.',
      routingTags: ['fallback-review']
    };
  }

  /**
   * Executes full policy evaluation pipeline to produce GatewayDecision.
   */
  public evaluate(
    payload: TriageRequestPayload,
    result: EvaluatorResult,
    config: GatewayPolicyConfig = DEFAULT_POLICY_CONFIG
  ): GatewayDecision {
    const { answers, latencyMs, usage } = result;
    const requestId = payload.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const source = payload.source || 'api:direct';

    const signals = this.extractSignals(result, config);
    const verdict = this.evaluateRules(signals, config);

    return {
      requestId,
      source,
      receivedAt: payload.timestamp || new Date().toISOString(),
      evaluatedAt: new Date().toISOString(),
      latencyMs,
      tokenUsage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens
      },
      guardrails: signals.guardrails,
      classification: {
        selected: signals.selectedDept,
        confidence: signals.deptConfidence,
        probabilities: signals.deptProbabilities
      },
      severity: {
        score: Number(signals.severityScore.toFixed(2)),
        confidence: Number(signals.severityConfidence.toFixed(2)),
        levelLabel: signals.severityLevelLabel,
        probabilities: signals.severityProbabilities
      },
      sentiment: {
        score: Number(signals.sentimentScore.toFixed(2)),
        confidence: Number(signals.sentimentConfidence.toFixed(2)),
        levelLabel: signals.sentimentLevelLabel,
        probabilities: signals.sentimentProbabilities
      },
      isActionable: Number(signals.isActionable.toFixed(2)),
      verdict: {
        action: verdict.action,
        targetQueue: verdict.targetQueue,
        priority: verdict.priority,
        compositeRiskScore: signals.compositeRiskScore,
        summaryReason: verdict.summaryReason,
        routingTags: verdict.routingTags
      },
      rawAnswers: answers
    };
  }
}
