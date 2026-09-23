import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

/**
 * Creates and initializes a SQLite database connection with WAL mode
 * and creates all required tables and indexes if they do not exist.
 */
export function createDatabaseConnection(
  dbPath: string = path.join(process.cwd(), 'data/gateway.db')
): DatabaseSync {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for high concurrency
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch {
    // Continue if pragmas are not supported in this runtime mode
  }

  initSchema(db);
  return db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
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
