# ReflexGate — Intelligent Real-Time Guardrail & Triage Gateway

An ultra-fast, production-grade API and webhook guardrail & triage gateway built with **TypeScript** and powered by **TypeSafe AI's flagship System One model (`Jev`)**.

## Features

- **7-Dimension Speculative Fan-out in a Single Request**:
  - Prompt Injection Defense (`Noul`)
  - Toxicity & Abuse Filtering (`Noul`)
  - PII & Secret Leak Detection (`Noul`)
  - Operational Department Classification (`Choice`)
  - Incident Severity Rating (`Score` 0 - 3)
  - Churn Risk & Sentiment (`Score` 0 - 3)
  - Actionability & Completeness Check (`Noul`)
- **Deterministic Policy Router**: Code controls side effects, quarantine blocks, SLA alerts, and confidence gates.
- **Dynamic Policy Tuning**: Runtime adjustment of confidence gates and guardrail thresholds via UI sliders or REST API.
- **Persistent SQLite Audit Storage**: Native zero-dependency `node:sqlite` storage with multi-filter queries and CSV export.
- **Outbound Webhook & Alert Dispatcher**: Automatically forwards decisions to Slack/Discord, downstream APIs, or the built-in local mock receiver.
- **Interactive Developer Workbench**: Live 4-tab UI at `http://localhost:3000` (`⚡ Workbench`, `⚙️ Policy Rules`, `📤 Outbound Feeds`, `📜 SQLite Audit Log`).
- **Container Ready**: Production `Dockerfile` and `docker-compose.yml`.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run CLI simulation
npm run demo

# 3. Start Gateway Server & Dashboard
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to test payloads in real-time.

## Docker Deployment

```bash
docker compose up -d
```
