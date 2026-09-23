import { GatewayDecision } from '../types.js';
import { GatewayPolicyConfig } from '../config.js';
import { DispatchLog } from './types.js';
import { sendJsonPost } from './http.js';
import { buildSlackPayload } from './slack.js';

export class OutboundDispatcher {
  private dispatchLogs: DispatchLog[] = [];
  private readonly maxLogs = 100;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  public setPort(port: number): void {
    this.port = port;
  }

  /**
   * Dispatches a completed gateway decision to configured outbound webhooks.
   * Runs asynchronously without blocking the primary gateway response.
   */
  public async dispatch(decision: GatewayDecision, config: GatewayPolicyConfig): Promise<void> {
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

    // Fire all without throwing unhandled rejections
    await Promise.allSettled(promises);
  }

  private async dispatchToMockReceiver(decision: GatewayDecision): Promise<void> {
    const cleanQueue = decision.verdict.targetQueue.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mockUrl = `http://localhost:${this.port}/api/v1/mock-downstream/${cleanQueue}`;

    const payload = {
      event: 'gateway.triage.dispatched',
      decisionId: decision.requestId,
      verdict: decision.verdict,
      classification: decision.classification,
      severity: decision.severity,
      source: decision.source
    };

    const headers = {
      'X-Gateway-Event': 'triage.dispatch',
      'X-Gateway-Verdict': decision.verdict.action,
      'X-Gateway-Priority': decision.verdict.priority,
    };

    const result = await sendJsonPost(mockUrl, payload, headers, 3000);

    this.recordLog({
      id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: decision.requestId,
      targetQueue: decision.verdict.targetQueue,
      action: decision.verdict.action,
      priority: decision.verdict.priority,
      destinationType: 'mock_local',
      destinationUrl: mockUrl,
      status: result.ok ? 'DELIVERED' : (result.error?.includes('fetch failed') ? 'SIMULATED' : 'FAILED'),
      statusCode: result.statusCode || 200,
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString(),
      payloadSummary: `${decision.verdict.action} ➔ ${decision.verdict.targetQueue}`
    });
  }

  private async dispatchToSlack(decision: GatewayDecision, url: string): Promise<void> {
    const slackPayload = buildSlackPayload(decision);
    const result = await sendJsonPost(url, slackPayload, {}, 5000);

    this.recordLog({
      id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: decision.requestId,
      targetQueue: decision.verdict.targetQueue,
      action: decision.verdict.action,
      priority: decision.verdict.priority,
      destinationType: 'slack_discord',
      destinationUrl: url.slice(0, 30) + '...',
      status: result.ok ? 'DELIVERED' : 'FAILED',
      statusCode: result.statusCode,
      error: result.error,
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString(),
      payloadSummary: result.ok ? `Slack notification sent` : `Failed to deliver Slack notification`
    });
  }

  private async dispatchToGenericWebhook(decision: GatewayDecision, url: string): Promise<void> {
    const headers = {
      'X-Gateway-Event': 'triage.verdict',
      'X-Gateway-Verdict': decision.verdict.action,
      'X-Gateway-Priority': decision.verdict.priority,
    };

    const result = await sendJsonPost(url, decision, headers, 5000);

    this.recordLog({
      id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: decision.requestId,
      targetQueue: decision.verdict.targetQueue,
      action: decision.verdict.action,
      priority: decision.verdict.priority,
      destinationType: 'generic_webhook',
      destinationUrl: url.slice(0, 30) + '...',
      status: result.ok ? 'DELIVERED' : 'FAILED',
      statusCode: result.statusCode,
      error: result.error,
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString(),
      payloadSummary: result.ok ? `Forwarded to webhook endpoint` : `Failed to deliver to generic webhook`
    });
  }

  private recordLog(log: DispatchLog): void {
    this.dispatchLogs.unshift(log);
    if (this.dispatchLogs.length > this.maxLogs) {
      this.dispatchLogs.pop();
    }
  }

  public getDispatchLogs(): DispatchLog[] {
    return [...this.dispatchLogs];
  }
}
