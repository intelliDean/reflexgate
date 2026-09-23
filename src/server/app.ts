import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GuardrailGateway } from '../core/gateway.js';
import { createApiV1Router } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(gateway: GuardrailGateway): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static files for dashboard
  app.use(express.static(path.join(__dirname, '../../public')));

  // Mount API routes
  app.use('/api/v1', createApiV1Router(gateway));

  return app;
}
