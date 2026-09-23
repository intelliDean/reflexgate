import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { GatewayDecision, GatewayMetrics } from './types.js';
import { GatewayPolicyConfig, DEFAULT_POLICY_CONFIG } from './config.js';

export interface DecisionQueryFilters {
  action?: string;
  priority?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class GatewayDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = path.join(process.cwd(), 'data/gateway.db')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        source TEXT,
        received_at TEXT,
        evaluated_at TEXT,
        latency_ms INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        action TEXT,
        target_queue TEXT,
        priority TEXT,
        composite_risk_score INTEGER,
        summary_reason TEXT,
        content_snippet TEXT,
        full_decision_json TEXT,
        department TEXT,
        confidence REAL,
        severity_score REAL,
        sentiment_score REAL,
        is_safe INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);
      CREATE INDEX IF NOT EXISTS idx_decisions_priority ON decisions(priority);
      CREATE INDEX IF NOT EXISTS idx_decisions_dept ON decisions(department);
      CREATE INDEX IF NOT EXISTS idx_decisions_time ON decisions(evaluated_at DESC);

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  saveDecision(decision: GatewayDecision, rawContent: string | Record<string, any>): void {
    const contentSnippet = typeof rawContent === 'string' 
      ? rawContent.slice(0, 300) 
      : JSON.stringify(rawContent).slice(0, 300);

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

    stmt.run(
      decision.requestId,
      decision.source,
      decision.receivedAt,
      decision.evaluatedAt,
      decision.latencyMs,
      decision.tokenUsage.inputTokens,
      decision.tokenUsage.outputTokens,
      decision.verdict.action,
      decision.verdict.targetQueue,
      decision.verdict.priority,
      decision.verdict.compositeRiskScore,
      decision.verdict.summaryReason,
      contentSnippet,
      JSON.stringify(decision),
      decision.classification.selected,
      decision.classification.confidence,
      decision.severity.score,
      decision.sentiment.score,
      decision.guardrails.isSafe ? 1 : 0
    );
  }

  queryDecisions(filters: DecisionQueryFilters = {}): { total: number; decisions: GatewayDecision[] } {
    let whereClauses: string[] = [];
    let params: (string | number)[] = [];

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
    const decisions = rows.map(r => JSON.parse(r.full_decision_json) as GatewayDecision);

    return { total, decisions };
  }

  getMetrics(): GatewayMetrics {
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

  exportCsv(): string {
    const stmt = this.db.prepare(`
      SELECT id, source, evaluated_at, action, target_queue, priority,
             department, confidence, severity_score, sentiment_score,
             composite_risk_score, latency_ms, summary_reason, content_snippet
      FROM decisions
      ORDER BY evaluated_at DESC
    `);
    const rows = stmt.all() as any[];

    if (rows.length === 0) {
      return 'id,source,evaluated_at,action,target_queue,priority,department,confidence,severity,sentiment,risk_score,latency_ms,summary,snippet\n';
    }

    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map(row => {
      return Object.values(row).map(val => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    });

    return [headers, ...lines].join('\n');
  }

  loadConfig(): GatewayPolicyConfig {
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

  saveConfig(config: GatewayPolicyConfig): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run('policy_config', JSON.stringify(config));
  }
}
