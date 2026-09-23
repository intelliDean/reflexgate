import { DatabaseSync } from 'node:sqlite';
import { GatewayDecision, GatewayMetrics } from '../types.js';
import { GatewayPolicyConfig, DEFAULT_POLICY_CONFIG } from '../config.js';
import { createDatabaseConnection } from './connection.js';
import { mapDecisionToRowParams, parseDecisionFromRow } from './mappers.js';
import { formatRowsToCsv } from './csv.js';

export interface DecisionQueryFilters {
  action?: string;
  priority?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class AuditRepository {
  private readonly db: DatabaseSync;

  constructor(dbOrPath?: DatabaseSync | string) {
    if (typeof dbOrPath === 'string' || dbOrPath === undefined) {
      this.db = createDatabaseConnection(dbOrPath);
    } else {
      this.db = dbOrPath;
    }
  }

  public saveDecision(decision: GatewayDecision, rawContent: string | Record<string, any>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO decisions (
        id, source, received_at, evaluated_at, latency_ms,
        input_tokens, output_tokens, action, target_queue,
        priority, composite_risk_score, summary_reason,
        content_snippet, full_decision_json, department,
        confidence, severity_score, sentiment_score, is_safe
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const params = mapDecisionToRowParams(decision, rawContent);
    stmt.run(...params);
  }

  public queryDecisions(filters: DecisionQueryFilters = {}): { total: number; decisions: GatewayDecision[] } {
    const { whereSql, params } = this.buildWhereClause(filters);

    // Count total matching
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM decisions ${whereSql}`);
    const countResult = countStmt.get(...params) as { total: number } | undefined;
    const total = countResult?.total ?? 0;

    // Fetch paginated
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const querySql = `
      SELECT full_decision_json FROM decisions
      ${whereSql}
      ORDER BY evaluated_at DESC
      LIMIT ? OFFSET ?
    `;

    const selectStmt = this.db.prepare(querySql);
    const rows = selectStmt.all(...params, limit, offset) as { full_decision_json: string }[];
    const decisions = rows.map(parseDecisionFromRow);

    return { total, decisions };
  }

  private buildWhereClause(filters: DecisionQueryFilters): { whereSql: string; params: (string | number)[] } {
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.action && filters.action !== 'ALL') {
      whereClauses.push('action = ?');
      params.push(filters.action);
    }

    if (filters.priority && filters.priority !== 'ALL') {
      whereClauses.push('priority = ?');
      params.push(filters.priority);
    }

    if (filters.department && filters.department !== 'ALL') {
      whereClauses.push('department = ?');
      params.push(filters.department);
    }

    if (filters.search && filters.search.trim() !== '') {
      whereClauses.push('(content_snippet LIKE ? OR summary_reason LIKE ? OR id LIKE ?)');
      const pattern = `%${filters.search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return { whereSql, params };
  }

  public getMetrics(): GatewayMetrics {
    const statsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as totalProcessed,
        SUM(CASE WHEN action = 'SECURITY_BLOCK' THEN 1 ELSE 0 END) as totalBlocked,
        SUM(CASE WHEN action = 'AUTO_DISPATCH' THEN 1 ELSE 0 END) as totalAutoDispatched,
        SUM(CASE WHEN action = 'HUMAN_REVIEW' THEN 1 ELSE 0 END) as totalHumanReview,
        SUM(CASE WHEN action = 'ESCALATE_CRITICAL' THEN 1 ELSE 0 END) as totalCriticalEscalated,
        AVG(latency_ms) as avgLatency
      FROM decisions
    `);

    const row = statsStmt.get() as any;
    const { decisions } = this.queryDecisions({ limit: 50 });

    return {
      totalProcessed: Number(row?.totalProcessed || 0),
      totalBlocked: Number(row?.totalBlocked || 0),
      totalAutoDispatched: Number(row?.totalAutoDispatched || 0),
      totalHumanReview: Number(row?.totalHumanReview || 0),
      totalCriticalEscalated: Number(row?.totalCriticalEscalated || 0),
      averageLatencyMs: Math.round(Number(row?.avgLatency || 0)),
      recentDecisions: decisions
    };
  }

  public exportCsv(): string {
    const stmt = this.db.prepare(`
      SELECT id, source, evaluated_at, action, target_queue, priority,
             department, confidence, severity_score, sentiment_score,
             composite_risk_score, latency_ms, summary_reason, content_snippet
      FROM decisions
      ORDER BY evaluated_at DESC
    `);
    const rows = stmt.all() as Record<string, any>[];
    return formatRowsToCsv(rows);
  }

  public loadConfig(): GatewayPolicyConfig {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get('policy_config') as { value: string } | undefined;
    if (row && row.value) {
      try {
        return { ...DEFAULT_POLICY_CONFIG, ...JSON.parse(row.value) };
      } catch {
        return DEFAULT_POLICY_CONFIG;
      }
    }
    return DEFAULT_POLICY_CONFIG;
  }

  public saveConfig(config: GatewayPolicyConfig): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run('policy_config', JSON.stringify(config));
  }
}
