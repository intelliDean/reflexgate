import { DatabaseSync } from 'node:sqlite';
import { AuditRepository, DecisionQueryFilters } from './db/repository.js';

export * from './db/connection.js';
export * from './db/mappers.js';
export * from './db/csv.js';
export * from './db/repository.js';

/**
 * GatewayDatabase is an alias for AuditRepository to maintain backward compatibility.
 */
export class GatewayDatabase extends AuditRepository {
  constructor(dbOrPath?: DatabaseSync | string) {
    super(dbOrPath);
  }
}
