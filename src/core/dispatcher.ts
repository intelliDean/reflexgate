import { GatewayDecision } from './types.js';
import { GatewayPolicyConfig } from './config.js';

export interface DispatchLog {
  id: string;
  requestId: string;
  targetQueue: string;
  action: string;
  priority: string;
  destinationType: 'mock_local' | 'slack_discord' | 'generic_webhook';
  destinationUrl?: string;
  status: 'DELIVERED' | 'FAILED' | 'SIMULATED';
  statusCode?: number;
  error?: string;
  latencyMs: number;
  timestamp: string;
  payloadSummary: string;
}

export class OutboundDispatcher {
  private dispatchLogs: DispatchLog[] = [];
  private readonly maxLogs = 100;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  setPort(port: number): void {
    this.port = port;
  }

  /**
   * Dispatches a completed gateway decision to configured outbound webhooks.
   * Runs asynchronously without blocking the primary gateway response.
   */
  async dispatch(decision: GatewayDecision, config: GatewayPolicyConfig): Promise<void> {
    const promises: Promise<void>[] = [];

    // 1. Built-in Mock Downstream Delivery
    if (config.enableMockDownstream) {
      promises.push(this.dispatchToMockReceiver(decision));
    }

    // 2. Slack or Discord Webhook
    if (config.slackWebhookUrl && config.slackWebhookUrl.startsWith('http')) {
      promises.push(this.dispatchToSlack(decision, config.slackWebhookUrl));
    }

    // 3. Generic Custom Webhook
    if (config.genericWebhookUrl && config.genericWebhookUrl.startsWith('http')) {
      promises.push(this.dispatchToGenericWebhook(decision, config.genericWebhookUrl));
    }

    // Fire all without throwing
    await Promise.allSettled(promises);
  }

  private async dispatchToMockReceiver(decision: GatewayDecision): Promise<void> {
    const start = performance.now();
    const cleanQueue = decision.verdict.targetQueue.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mockUrl = `http://localhost:${this.port}/api/v1/mock-downstream/${cleanQueue}`;

    try {
      const res = await fetch(mockUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Event': 'triage.dispatch',
          'X-Gateway-Verdict': decision.verdict.action,
          'X-Gateway-Priority': decision.verdict.priority,
        },
        body: JSON.stringify({
          event: 'gateway.triage.dispatched',
          decisionId: decision.requestId,
          verdict: decision.verdict,
          classification: decision.classification,
          severity: decision.severity,
          source: decision.source
        })
      });

      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'mock_local',
        destinationUrl: mockUrl,
        status: res.ok ? 'DELIVERED' : 'FAILED',
        statusCode: res.status,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `${decision.verdict.action} ➔ ${decision.verdict.targetQueue}`
      });
    } catch (err: any) {
      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'mock_local',
        destinationUrl: mockUrl,
        status: 'SIMULATED',
        statusCode: 200,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `Simulated dispatch: ${decision.verdict.action} ➔ ${decision.verdict.targetQueue}`
      });
    }
  }

  private async dispatchToSlack(decision: GatewayDecision, url: string): Promise<void> {
    const start = performance.now();
    const isAlert = decision.verdict.action === 'SECURITY_BLOCK' || decision.verdict.action === 'ESCALATE_CRITICAL';
    const color = decision.verdict.action === 'SECURITY_BLOCK' ? '#f43f5e' :
                  decision.verdict.action === 'ESCALATE_CRITICAL' ? '#a855f7' :
                  decision.verdict.action === 'AUTO_DISPATCH' ? '#10b981' : '#f59e0b';

    const slackPayload = {
      text: `[TypeSafe Gateway] ${decision.verdict.action}: ${decision.verdict.targetQueue}`,
      attachments: [
        {
          color,
          title: `${isAlert ? '🚨' : '⚡'} ${decision.verdict.action} (Priority: ${decision.verdict.priority})`,
          text: decision.verdict.summaryReason,
          fields: [
            { title: 'Department', value: `${decision.classification.selected} (${Math.round(decision.classification.confidence * 100)}% conf)`, short: true },
            { title: 'Severity Score', value: `${decision.severity.score} / 3.0 (${decision.severity.levelLabel})`, short: true },
            { title: 'Risk Score', value: `${decision.verdict.compositeRiskScore} / 100`, short: true },
            { title: 'Source', value: decision.source, short: true }
          ],
          footer: 'TypeSafe AI System One (Jev)',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload)
      });

      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'slack_discord',
        destinationUrl: url.slice(0, 30) + '...',
        status: res.ok ? 'DELIVERED' : 'FAILED',
        statusCode: res.status,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `Slack alert sent (${res.status})`
      });
    } catch (err: any) {
      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'slack_discord',
        destinationUrl: url.slice(0, 30) + '...',
        status: 'FAILED',
        error: err.message,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `Failed to deliver Slack notification`
      });
    }
  }

  private async dispatchToGenericWebhook(decision: GatewayDecision, url: string): Promise<void> {
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Event': 'triage.verdict',
          'X-Gateway-Verdict': decision.verdict.action,
          'X-Gateway-Priority': decision.verdict.priority,
        },
        body: JSON.stringify(decision)
      });

      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'generic_webhook',
        destinationUrl: url.slice(0, 30) + '...',
        status: res.ok ? 'DELIVERED' : 'FAILED',
        statusCode: res.status,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `Forwarded to webhook endpoint (${res.status})`
      });
    } catch (err: any) {
      this.recordLog({
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: decision.requestId,
        targetQueue: decision.verdict.targetQueue,
        action: decision.verdict.action,
        priority: decision.verdict.priority,
        destinationType: 'generic_webhook',
        destinationUrl: url.slice(0, 30) + '...',
        status: 'FAILED',
        error: err.message,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        payloadSummary: `Failed to deliver to generic webhook`
      });
    }
  }

  private recordLog(log: DispatchLog): void {
    this.dispatchLogs.unshift(log);
    if (this.dispatchLogs.length > this.maxLogs) {
      this.dispatchLogs.pop();
    }
  }

  getDispatchLogs(): DispatchLog[] {
    return [...this.dispatchLogs];
  }
}
