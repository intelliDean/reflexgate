import { 
  TriageRequestPayload, 
  GatewayDecision 
} from './types.js';
import { EvaluatorResult } from './evaluator.js';
import { GatewayPolicyConfig, DEFAULT_POLICY_CONFIG } from './config.js';
import { PolicyEngine } from './policy/engine.js';

export * from './policy/types.js';
export * from './policy/engine.js';
export * from './policy/rules/guardrail.js';
export * from './policy/rules/critical_sla.js';
export * from './policy/rules/confidence_gate.js';
export * from './policy/rules/auto_dispatch.js';

export class DeterministicPolicyRouter {
  private readonly engine: PolicyEngine;

  constructor(customEngine?: PolicyEngine) {
    this.engine = customEngine || new PolicyEngine();
  }

  /**
   * Applies deterministic business rules, guardrails, and confidence-gated routing
   * to raw TypeSafe System One evaluation outputs, using active policy config.
   */
  route(
    payload: TriageRequestPayload, 
    result: EvaluatorResult, 
    config: GatewayPolicyConfig = DEFAULT_POLICY_CONFIG
  ): GatewayDecision {
    return this.engine.evaluate(payload, result, config);
  }
}
