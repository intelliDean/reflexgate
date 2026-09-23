import { Router, Request, Response } from 'express';
import { GuardrailGateway } from '../../core/gateway.js';

export function createDispatchesRouter(gateway: GuardrailGateway): Router {
  const router = Router();

  // In-memory queue of mock downstream deliveries
  const mockDownstreamDeliveries: Array<{
    queue: string;
    receivedAt: string;
    payload: any;
  }> = [];

  // GET /api/v1/dispatches
  router.get('/dispatches', (_req: Request, res: Response) => {
    res.json({
      dispatches: gateway.getDispatchLogs(),
      mockDownstreamDeliveries
    });
  });

  // POST /api/v1/mock-downstream/:queue
  router.post('/mock-downstream/:queue', (req: Request, res: Response) => {
    const queue = req.params.queue;
    const entry = {
      queue,
      receivedAt: new Date().toISOString(),
      payload: req.body
    };
    mockDownstreamDeliveries.unshift(entry);
    if (mockDownstreamDeliveries.length > 50) {
      mockDownstreamDeliveries.pop();
    }
    res.json({ status: 'delivered', queue, receivedAt: entry.receivedAt });
  });

  return router;
}
