import { PolicyRule, ExtractedSignals, RuleEvaluationResult } from '../types.js';
import { GatewayPolicyConfig } from '../../config.js';

/**
 * GuardrailRule: Intercepts security violations including prompt injection,
 * toxicity/abuse, and credential or PII leaks.
 */
export class GuardrailRule implements PolicyRule {
  readonly name = 'GuardrailRule';

  evaluate(signals: ExtractedSignals, _config: GatewayPolicyConfig): RuleEvaluationResult | null {
    if (!signals.guardrails.isSafe) {
      return {
        action: 'SECURITY_BLOCK',
        targetQueue: 'quarantine:security',
        priority: 'P1_CRITICAL',
        summaryReason: `Blocked by Guardrail: ${signals.guardrails.violations.join(', ')}`,
        routingTags: [`dept:${signals.selectedDept}`, 'security-blocked']
      };
    }
    return null;
  }
}
