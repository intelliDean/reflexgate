import { Router, Request, Response } from 'express';
import { GuardrailGateway } from '../../core/gateway.js';

export function createAuditRouter(gateway: GuardrailGateway): Router {
  const router = Router();

  // GET /api/v1/metrics
  router.get('/metrics', (_req: Request, res: Response) => {
    res.json(gateway.getMetrics());
  });

  // GET /api/v1/history
  router.get('/history', (req: Request, res: Response) => {
    const { action, priority, department, search, limit, offset } = req.query;
    const result = gateway.queryHistory({
      action: action ? String(action) : undefined,
      priority: priority ? String(priority) : undefined,
      department: department ? String(department) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  });

  // GET /api/v1/history/export
  router.get('/history/export', (_req: Request, res: Response) => {
    const csv = gateway.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reflexgate_audit_log.csv"');
    res.send(csv);
  });

  return router;
}
