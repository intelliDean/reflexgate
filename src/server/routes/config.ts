import { Router, Request, Response } from 'express';
import { GuardrailGateway } from '../../core/gateway.js';

export function createConfigRouter(gateway: GuardrailGateway): Router {
  const router = Router();

  // GET /api/v1/config
  router.get('/config', (_req: Request, res: Response) => {
    res.json(gateway.getConfig());
  });

  // PUT /api/v1/config
  router.put('/config', (req: Request, res: Response) => {
    try {
      const updated = gateway.updateConfig(req.body);
      res.json({ status: 'updated', config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
