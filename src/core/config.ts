export interface GatewayPolicyConfig {
  promptInjectionThreshold: number;   // default 0.65 (noul > threshold => block)
  toxicityThreshold: number;          // default 0.70 (noul > threshold => block)
  piiLeakThreshold: number;           // default 0.70 (noul > threshold => block)
  autoDispatchConfidenceMin: number;  // default 0.70 (choice confidence >= threshold => auto-dispatch)
  criticalSeverityMin: number;        // default 2.20 (score >= threshold => P1 Critical)
  slackWebhookUrl?: string;           // Optional Slack/Discord incoming webhook
  genericWebhookUrl?: string;         // Optional external downstream API webhook
  enableMockDownstream: boolean;      // default true: sends to local mock endpoint
}

export const DEFAULT_POLICY_CONFIG: GatewayPolicyConfig = {
  promptInjectionThreshold: 0.65,
  toxicityThreshold: 0.70,
  piiLeakThreshold: 0.70,
  autoDispatchConfidenceMin: 0.70,
  criticalSeverityMin: 2.20,
  slackWebhookUrl: '',
  genericWebhookUrl: '',
  enableMockDownstream: true,
};

export class ConfigManager {
  private currentConfig: GatewayPolicyConfig;

  constructor(initial?: Partial<GatewayPolicyConfig>) {
    this.currentConfig = { ...DEFAULT_POLICY_CONFIG, ...initial };
  }

  getConfig(): GatewayPolicyConfig {
    return { ...this.currentConfig };
  }

  updateConfig(updates: Partial<GatewayPolicyConfig>): GatewayPolicyConfig {
    this.currentConfig = {
      ...this.currentConfig,
      ...updates,
      // clamp thresholds to safe numerical ranges
      promptInjectionThreshold: Math.max(0.1, Math.min(0.99, Number(updates.promptInjectionThreshold ?? this.currentConfig.promptInjectionThreshold))),
      toxicityThreshold: Math.max(0.1, Math.min(0.99, Number(updates.toxicityThreshold ?? this.currentConfig.toxicityThreshold))),
      piiLeakThreshold: Math.max(0.1, Math.min(0.99, Number(updates.piiLeakThreshold ?? this.currentConfig.piiLeakThreshold))),
      autoDispatchConfidenceMin: Math.max(0.1, Math.min(0.99, Number(updates.autoDispatchConfidenceMin ?? this.currentConfig.autoDispatchConfidenceMin))),
      criticalSeverityMin: Math.max(0.5, Math.min(3.0, Number(updates.criticalSeverityMin ?? this.currentConfig.criticalSeverityMin))),
    };
    return this.getConfig();
  }
}
