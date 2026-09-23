import { TypeSafeGatewayEvaluator } from './evaluator.js';
import { DeterministicPolicyRouter } from './router.js';
import { GatewayDatabase, DecisionQueryFilters } from './db.js';
import { ConfigManager, GatewayPolicyConfig } from './config.js';
import { OutboundDispatcher, DispatchLog } from './dispatcher.js';
import { TriageRequestPayload, GatewayDecision, GatewayMetrics } from './types.js';

export class GuardrailGateway {
  private evaluator: TypeSafeGatewayEvaluator;
  private router: DeterministicPolicyRouter;
  private db: GatewayDatabase;
  private configManager: ConfigManager;
  private dispatcher: OutboundDispatcher;

  constructor(apiKey?: string, port: number = 3000) {
    this.evaluator = new TypeSafeGatewayEvaluator(apiKey);
    this.router = new DeterministicPolicyRouter();
    this.db = new GatewayDatabase();
    
    // Load persistent config from DB or fallback to default
    const savedConfig = this.db.loadConfig();
    this.configManager = new ConfigManager(savedConfig);
    this.dispatcher = new OutboundDispatcher(port);
  }

  setPort(port: number): void {
    this.dispatcher.setPort(port);
  }

  /**
   * Evaluates an incoming message or webhook, checks guardrails,
   * classifies intent, scores severity/sentiment, saves to SQLite,
   * and dispatches outbound alerts.
   */
  async triage(payload: TriageRequestPayload): Promise<GatewayDecision> {
    const rawResult = await this.evaluator.evaluate(payload.content);
    const activeConfig = this.configManager.getConfig();
    const decision = this.router.route(payload, rawResult, activeConfig);

    // 1. Save to persistent SQLite database
    try {
      this.db.saveDecision(decision, payload.content);
    } catch (err: any) {
      console.error('[Gateway] Failed to save decision to SQLite:', err.message);
    }

    // 2. Dispatch to outbound channels asynchronously (non-blocking)
    void this.dispatcher.dispatch(decision, activeConfig).catch((err) => {
      console.error('[Gateway] Outbound dispatch error:', err);
    });

    return decision;
  }

  /**
   * Retrieves operational metrics computed directly from SQLite.
   */
  getMetrics(): GatewayMetrics {
    return this.db.getMetrics();
  }

  /**
   * Queries historical decisions with multi-dimensional filtering.
   */
  queryHistory(filters: DecisionQueryFilters = {}): { total: number; decisions: GatewayDecision[] } {
    return this.db.queryDecisions(filters);
  }

  /**
   * Exports full audit history as CSV.
   */
  exportCsv(): string {
    return this.db.exportCsv();
  }

  /**
   * Gets current active policy configuration.
   */
  getConfig(): GatewayPolicyConfig {
    return this.configManager.getConfig();
  }

  /**
   * Updates active policy configuration and persists to SQLite.
   */
  updateConfig(updates: Partial<GatewayPolicyConfig>): GatewayPolicyConfig {
    const updated = this.configManager.updateConfig(updates);
    this.db.saveConfig(updated);
    return updated;
  }

  /**
   * Gets real-time outbound dispatch logs.
   */
  getDispatchLogs(): DispatchLog[] {
    return this.dispatcher.getDispatchLogs();
  }
}
