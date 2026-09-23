import dotenv from 'dotenv';
import { GuardrailGateway } from '../core/gateway.js';
import { createApp } from './app.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const gateway = new GuardrailGateway(process.env.TYPESAFE_API_KEY, PORT);
const app = createApp(gateway);

const server = app.listen(PORT, () => {
  gateway.setPort(PORT);
  console.log(`\n🚀 ReflexGate running on http://localhost:${PORT}`);
  console.log(`   Interactive Dashboard: http://localhost:${PORT}`);
  console.log(`   POST /api/v1/triage`);
  console.log(`   POST /api/v1/webhook/:source\n`);
});

export { app, gateway, server };
