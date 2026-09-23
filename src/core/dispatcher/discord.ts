import { GatewayDecision } from '../types.js';

export function getDiscordColor(action: string): number {
  switch (action) {
    case 'SECURITY_BLOCK':
      return 0xf43f5e;
    case 'ESCALATE_CRITICAL':
      return 0xa855f7;
    case 'AUTO_DISPATCH':
      return 0x10b981;
    case 'HUMAN_REVIEW':
    default:
      return 0xf59e0b;
  }
}

export function buildDiscordPayload(decision: GatewayDecision): Record<string, any> {
  const isAlert = decision.verdict.action === 'SECURITY_BLOCK' || decision.verdict.action === 'ESCALATE_CRITICAL';

  return {
    content: `${isAlert ? '🚨' : '⚡'} **ReflexGate Alert**: ${decision.verdict.action}`,
    embeds: [
      {
        title: `${decision.verdict.action} (Priority: ${decision.verdict.priority})`,
        description: decision.verdict.summaryReason,
        color: getDiscordColor(decision.verdict.action),
        fields: [
          { name: 'Target Queue', value: decision.verdict.targetQueue, inline: true },
          { name: 'Department', value: `${decision.classification.selected}`, inline: true },
          { name: 'Severity', value: `${decision.severity.score} / 3.0`, inline: true },
          { name: 'Risk Score', value: `${decision.verdict.compositeRiskScore} / 100`, inline: true },
          { name: 'Latency', value: `${decision.latencyMs} ms`, inline: true },
          { name: 'Source', value: decision.source, inline: true }
        ],
        footer: { text: 'ReflexGate — TypeSafe AI Jev' },
        timestamp: new Date().toISOString()
      }
    ]
  };
}
