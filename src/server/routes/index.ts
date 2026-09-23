import { Router, Request, Response } from 'express';
import { GuardrailGateway } from '../../core/gateway.js';
import { PRESET_SCENARIOS } from '../constants.js';
import { createTriageRouter } from './triage.js';
import { createAuditRouter } from './audit.js';
import { createConfigRouter } from './config.js';
import { createDispatchesRouter } from './dispatches.js';

export function createApiV1Router(gateway: GuardrailGateway): Router {
  const router = Router();

  // Mount domain routers
  router.use('/', createTriageRouter(gateway));
  router.use('/', createAuditRouter(gateway));
  router.use('/', createConfigRouter(gateway));
  router.use('/', createDispatchesRouter(gateway));

  // GET /api/v1/presets
  router.get('/presets', (_req: Request, res: Response) => {
    res.json(PRESET_SCENARIOS);
  });

  // GET /api/v1/health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      uptimeSeconds: Math.round(process.uptime()),
      model: 'jev-latest',
      engine: 'TypeSafe AI System One',
      storage: 'SQLite (Native Node)',
      dispatcher: 'Active'
    });
  });

  return router;
}
