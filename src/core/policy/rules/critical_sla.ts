import { PolicyRule, ExtractedSignals, RuleEvaluationResult } from '../types.js';
import { GatewayPolicyConfig } from '../../config.js';

/**
 * CriticalSlaRule: Triggers emergency escalation when severity indicates
 * a complete service outage or when a verified security incident is detected.
 */
export class CriticalSlaRule implements PolicyRule {
  readonly name = 'CriticalSlaRule';

  evaluate(signals: ExtractedSignals, config: GatewayPolicyConfig): RuleEvaluationResult | null {
    const isOutageScore = signals.severityScore >= config.criticalSeverityMin;
    const isSecurityIncident = signals.selectedDept === 'security_incident' && 
                               signals.deptConfidence >= config.autoDispatchConfidenceMin;

    if (isOutageScore || isSecurityIncident) {
      return {
        action: 'ESCALATE_CRITICAL',
        targetQueue: 'oncall:pagerduty_p1',
        priority: 'P1_CRITICAL',
        summaryReason: `P1 Critical Alert: Severe business impact (score: ${signals.severityScore.toFixed(2)}) with ${signals.selectedDept}`,
        routingTags: [`dept:${signals.selectedDept}`, 'urgent-sla', 'p1-escalation']
      };
    }

    return null;
  }
}
