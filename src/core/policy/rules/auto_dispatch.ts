import { PolicyRule, ExtractedSignals, RuleEvaluationResult, PriorityLevel } from '../types.js';
import { GatewayPolicyConfig } from '../../config.js';

/**
 * AutoDispatchRule: Routes high-confidence requests directly to their department queue,
 * computing appropriate priority and tags based on urgency and context clarity.
 */
export class AutoDispatchRule implements PolicyRule {
  readonly name = 'AutoDispatchRule';

  evaluate(signals: ExtractedSignals, _config: GatewayPolicyConfig): RuleEvaluationResult {
    let priority: PriorityLevel = 'P3_NORMAL';
    const routingTags: string[] = [`dept:${signals.selectedDept}`, 'auto-routed'];

    if (signals.severityScore >= 1.5 || signals.sentimentScore >= 2.0) {
      priority = 'P2_HIGH';
      routingTags.push('high-priority');
    } else if (signals.isActionable < 0.40) {
      priority = 'P4_LOW';
      routingTags.push('vague-context');
    }

    const confidencePct = (signals.deptConfidence * 100).toFixed(0);

    return {
      action: 'AUTO_DISPATCH',
      targetQueue: `dispatch:${signals.selectedDept}`,
      priority,
      summaryReason: `Auto-routed to ${signals.selectedDept} with ${confidencePct}% confidence.`,
      routingTags
    };
  }
}
