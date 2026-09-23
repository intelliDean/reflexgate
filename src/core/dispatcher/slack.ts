import { GatewayDecision } from '../types.js';

export function getVerdictColor(action: string): string {
  switch (action) {
    case 'SECURITY_BLOCK':
      return '#f43f5e'; // Rose
    case 'ESCALATE_CRITICAL':
      return '#a855f7'; // Purple
    case 'AUTO_DISPATCH':
      return '#10b981'; // Emerald
    case 'HUMAN_REVIEW':
    default:
      return '#f59e0b'; // Amber
  }
}

export function buildSlackPayload(decision: GatewayDecision): Record<string, any> {
  const isAlert = decision.verdict.action === 'SECURITY_BLOCK' || decision.verdict.action === 'ESCALATE_CRITICAL';
  const color = getVerdictColor(decision.verdict.action);

  return {
    text: `[ReflexGate] ${decision.verdict.action}: ${decision.verdict.targetQueue}`,
    attachments: [
      {
        color,
        title: `${isAlert ? '🚨' : '⚡'} ${decision.verdict.action} (Priority: ${decision.verdict.priority})`,
        text: decision.verdict.summaryReason,
        fields: [
          { 
            title: 'Department', 
            value: `${decision.classification.selected} (${Math.round(decision.classification.confidence * 100)}% conf)`, 
            short: true 
          },
          { 
            title: 'Severity Score', 
            value: `${decision.severity.score} / 3.0 (${decision.severity.levelLabel})`, 
            short: true 
          },
          { 
            title: 'Risk Score', 
            value: `${decision.verdict.compositeRiskScore} / 100`, 
            short: true 
          },
          { 
            title: 'Source', 
            value: decision.source, 
            short: true 
          }
        ],
        footer: 'ReflexGate — TypeSafe AI System One (Jev)',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
}
