import { 
  TriageRequestPayload, 
  GatewayDecision, 
  TriageAction, 
  Department, 
  GuardrailResults 
} from './types.js';
import { EvaluatorResult } from './evaluator.js';
import { GatewayPolicyConfig, DEFAULT_POLICY_CONFIG } from './config.js';

export class DeterministicPolicyRouter {
  /**
   * Applies deterministic business rules, guardrails, and confidence-gated routing
   * to raw TypeSafe System One evaluation outputs, using active policy config.
   */
  route(
    payload: TriageRequestPayload, 
    result: EvaluatorResult, 
    config: GatewayPolicyConfig = DEFAULT_POLICY_CONFIG
  ): GatewayDecision {
    const { answers, latencyMs, usage, model } = result;
    const requestId = payload.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const source = payload.source || 'api:direct';

    // 1. Guardrail Evaluations (Noul probabilities) checked against dynamic thresholds
    const promptInjection = answers.prompt_injection?.noul ?? 0.0;
    const toxicity = answers.toxicity?.noul ?? 0.0;
    const piiLeak = answers.pii_leak?.noul ?? 0.0;

    const violations: string[] = [];
    if (promptInjection >= config.promptInjectionThreshold) {
      violations.push(`Prompt Injection / Jailbreak Attempt detected (${(promptInjection * 100).toFixed(0)}% >= ${(config.promptInjectionThreshold * 100).toFixed(0)}%)`);
    }
    if (toxicity >= config.toxicityThreshold) {
      violations.push(`Severe Toxicity / Harassment detected (${(toxicity * 100).toFixed(0)}% >= ${(config.toxicityThreshold * 100).toFixed(0)}%)`);
    }
    if (piiLeak >= config.piiLeakThreshold) {
      violations.push(`Unsafe Credential / PII Exposure detected (${(piiLeak * 100).toFixed(0)}% >= ${(config.piiLeakThreshold * 100).toFixed(0)}%)`);
    }

    const isSafe = violations.length === 0;
    const guardrails: GuardrailResults = {
      promptInjectionRisk: promptInjection,
      toxicityRisk: toxicity,
      piiLeakRisk: piiLeak,
      isSafe,
      violations
    };

    // 2. Department Classification (Choice)
    const selectedDept = (answers.department?.choice as Department) || 'general_feedback';
    const deptConfidence = answers.department?.confidence ?? 0.0;
    const deptProbabilities = (answers.department?.probabilities as Record<Department, number>) || {};

    // 3. Severity & Sentiment (Score)
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

    // 4. Actionability (Noul)
    const isActionable = answers.is_actionable?.noul ?? 1.0;

    // 5. Compute Composite Risk Score (0 - 100)
    const compositeRiskScore = Math.min(100, Math.round(
      (promptInjection * 40) +
      (toxicity * 25) +
      (piiLeak * 15) +
      ((severityScore / 3.0) * 12) +
      ((sentimentScore / 3.0) * 8)
    ));

    // 6. Policy Decision Logic
    let action: TriageAction = 'AUTO_DISPATCH';
    let targetQueue = `queue:${selectedDept}`;
    let priority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_NORMAL' | 'P4_LOW' = 'P3_NORMAL';
    let summaryReason = '';
    const routingTags: string[] = [`dept:${selectedDept}`];

    // RULE 1: Security Guardrail Violations
    if (!isSafe) {
      action = 'SECURITY_BLOCK';
      targetQueue = 'quarantine:security';
      priority = 'P1_CRITICAL';
      summaryReason = `Blocked by Guardrail: ${violations.join(', ')}`;
      routingTags.push('security-blocked');
    }
    // RULE 2: Critical Outage / System Incident Escalation
    else if (severityScore >= config.criticalSeverityMin || (selectedDept === 'security_incident' && deptConfidence >= config.autoDispatchConfidenceMin)) {
      action = 'ESCALATE_CRITICAL';
      targetQueue = 'oncall:pagerduty_p1';
      priority = 'P1_CRITICAL';
      summaryReason = `P1 Critical Alert: Severe business impact (score: ${severityScore.toFixed(2)}) with ${selectedDept}`;
      routingTags.push('urgent-sla', 'p1-escalation');
    }
    // RULE 3: Confidence-Gated Dispatch vs. Human Triage
    else if (deptConfidence < config.autoDispatchConfidenceMin) {
      action = 'HUMAN_REVIEW';
      targetQueue = 'triage:human_supervisor';
      priority = severityScore >= 1.5 ? 'P2_HIGH' : 'P3_NORMAL';
      summaryReason = `Low classification confidence (${(deptConfidence * 100).toFixed(0)}% < ${(config.autoDispatchConfidenceMin * 100).toFixed(0)}%). Diverted to human reviewer.`;
      routingTags.push('needs-human-review', 'low-confidence');
    }
    // RULE 4: Automated Dispatch (High Confidence)
    else {
      action = 'AUTO_DISPATCH';
      targetQueue = `dispatch:${selectedDept}`;
      if (severityScore >= 1.5 || sentimentScore >= 2.0) {
        priority = 'P2_HIGH';
        routingTags.push('high-priority');
      } else if (isActionable < 0.40) {
        priority = 'P4_LOW';
        routingTags.push('vague-context');
      } else {
        priority = 'P3_NORMAL';
      }
      summaryReason = `Auto-routed to ${selectedDept} with ${(deptConfidence * 100).toFixed(0)}% confidence.`;
      routingTags.push('auto-routed');
    }

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
      guardrails,
      classification: {
        selected: selectedDept,
        confidence: deptConfidence,
        probabilities: deptProbabilities
      },
      severity: {
        score: Number(severityScore.toFixed(2)),
        confidence: Number(severityConfidence.toFixed(2)),
        levelLabel: severityLevelLabel,
        probabilities: severityProbabilities
      },
      sentiment: {
        score: Number(sentimentScore.toFixed(2)),
        confidence: Number(sentimentConfidence.toFixed(2)),
        levelLabel: sentimentLevelLabel,
        probabilities: sentimentProbabilities
      },
      isActionable: Number(isActionable.toFixed(2)),
      verdict: {
        action,
        targetQueue,
        priority,
        compositeRiskScore,
        summaryReason,
        routingTags
      },
      rawAnswers: answers
    };
  }
}
