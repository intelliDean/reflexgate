import { Router, Request, Response } from 'express';
import { GuardrailGateway } from '../../core/gateway.js';
import { TriageRequestPayload } from '../../core/types.js';

export function createTriageRouter(gateway: GuardrailGateway): Router {
  const router = Router();

  // POST /api/v1/triage
  router.post('/triage', async (req: Request, res: Response) => {
    try {
      const { content, source = 'api:direct', id, metadata } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Missing required field: "content"' });
      }

      const payload: TriageRequestPayload = {
        id,
        source,
        content,
        metadata,
        timestamp: new Date().toISOString()
      };

      const decision = await gateway.triage(payload);
      return res.json(decision);
    } catch (err: any) {
      console.error('Triage error:', err);
      return res.status(500).json({ error: err.message || 'Internal gateway error' });
    }
  });

  // POST /api/v1/webhook/:source
  router.post('/webhook/:source', async (req: Request, res: Response) => {
    try {
      const source = `webhook:${req.params.source}`;
      const content = extractWebhookContent(req.body);

      const payload: TriageRequestPayload = {
        source,
        content,
        metadata: { headers: req.headers },
        timestamp: new Date().toISOString()
      };

      const decision = await gateway.triage(payload);
      return res.json({
        status: 'processed',
        decision
      });
    } catch (err: any) {
      console.error('Webhook error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function extractWebhookContent(body: any): string | Record<string, any> {
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object') {
    return body.text || body.message || body.content || body.description || body;
  }
  return String(body ?? '');
}
