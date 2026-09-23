import { PolicyRule, ExtractedSignals, RuleEvaluationResult } from '../types.js';
import { GatewayPolicyConfig } from '../../config.js';

/**
 * ConfidenceGateRule: Diverts ambiguous or low-confidence department classifications
 * to a human supervisor review queue.
 */
export class ConfidenceGateRule implements PolicyRule {
  readonly name = 'ConfidenceGateRule';

  evaluate(signals: ExtractedSignals, config: GatewayPolicyConfig): RuleEvaluationResult | null {
    if (signals.deptConfidence < config.autoDispatchConfidenceMin) {
      const priority = signals.severityScore >= 1.5 ? 'P2_HIGH' : 'P3_NORMAL';
      const actualPct = (signals.deptConfidence * 100).toFixed(0);
      const thresholdPct = (config.autoDispatchConfidenceMin * 100).toFixed(0);

      return {
        action: 'HUMAN_REVIEW',
        targetQueue: 'triage:human_supervisor',
        priority,
        summaryReason: `Low classification confidence (${actualPct}% < ${thresholdPct}%). Diverted to human reviewer.`,
        routingTags: [`dept:${signals.selectedDept}`, 'needs-human-review', 'low-confidence']
      };
    }

    return null;
  }
}
