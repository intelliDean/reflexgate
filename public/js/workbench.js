import { executeTriage, fetchMetrics } from './api.js';

export function updateMetrics(metrics) {
  if (!metrics) return;
  const processed = document.getElementById('stat-processed');
  const latency = document.getElementById('stat-latency');
  const blocked = document.getElementById('stat-blocked');
  const auto = document.getElementById('stat-auto');

  if (processed) processed.textContent = metrics.totalProcessed ?? 0;
  if (latency) latency.textContent = `${metrics.averageLatencyMs ?? 0} ms`;
  if (blocked) blocked.textContent = metrics.totalBlocked ?? 0;
  if (auto) auto.textContent = metrics.totalAutoDispatched ?? 0;
}

export function selectPreset(preset, btnElement) {
  document.querySelectorAll('.preset-chips .chip').forEach(c => c.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const sourceInput = document.getElementById('input-source');
  const contentInput = document.getElementById('input-content');

  if (sourceInput) sourceInput.value = preset.source;
  if (contentInput) contentInput.value = preset.content;
}

export function renderPresets(presets) {
  const container = document.getElementById('preset-chips');
  if (!container) return;
  container.innerHTML = '';

  presets.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${idx === 0 ? 'active' : ''}`;
    btn.innerHTML = `${p.title}`;
    btn.onclick = () => selectPreset(p, btn);
    container.appendChild(btn);
  });

  if (presets.length > 0) {
    selectPreset(presets[0], container.children[0]);
  }
}

export function renderDecision(d) {
  const v = d.verdict;
  const g = d.guardrails;
  const c = d.classification;

  const latencyIndicator = document.getElementById('latency-indicator');
  if (latencyIndicator) {
    latencyIndicator.innerHTML = `⚡ ${d.latencyMs} ms &bull; ${d.tokenUsage.inputTokens} tok in / ${d.tokenUsage.outputTokens} tok out`;
  }

  const verdictClass = 
    v.action === 'SECURITY_BLOCK' ? 'block' :
    v.action === 'ESCALATE_CRITICAL' ? 'escalate' :
    v.action === 'AUTO_DISPATCH' ? 'auto' : 'review';

  const verdictIcon = 
    v.action === 'SECURITY_BLOCK' ? '🛑' :
    v.action === 'ESCALATE_CRITICAL' ? '🚨' :
    v.action === 'AUTO_DISPATCH' ? '⚡' : '👤';

  const priorityClass = `priority-${v.priority.split('_')[0].toLowerCase()}`;

  // Build Department Choice probabilities breakdown
  let deptBars = '';
  if (c.probabilities) {
    for (const [dept, prob] of Object.entries(c.probabilities)) {
      const pct = Math.round(prob * 100);
      const isWinner = dept === c.selected;
      deptBars += `
        <div class="gauge-row">
          <div class="gauge-label-bar">
            <span style="${isWinner ? 'color: white; font-weight: 700;' : 'color: var(--text-faint);'}">${dept} ${isWinner ? '★' : ''}</span>
            <span style="font-family: var(--font-mono);">${pct}%</span>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill ${isWinner ? 'fill-primary' : ''}" style="width: ${pct}%; opacity: ${isWinner ? '1' : '0.3'};"></div>
          </div>
        </div>
      `;
    }
  }

  const html = `
    <div class="verdict-box ${verdictClass}">
      <div>
        <div class="verdict-title">
          <span>${verdictIcon} ${v.action}</span>
        </div>
        <div class="verdict-desc">${v.summaryReason}</div>
      </div>
      <div style="text-align: right;">
        <div class="priority-badge ${priorityClass}">${v.priority}</div>
        <div style="font-size: 0.72rem; color: var(--text-faint); margin-top: 0.35rem; font-family: var(--font-mono);">
          Risk: ${v.compositeRiskScore}/100
        </div>
      </div>
    </div>

    <div class="metric-grid-2">
      <div class="section-card">
        <div class="section-card-title">
          <span>🛡️ Guardrail Checks (Noul)</span>
          <span class="badge-sm ${g.isSafe ? 'badge-auto' : 'badge-block'}">${g.isSafe ? 'PASS' : 'VIOLATION'}</span>
        </div>

        <div class="gauge-row">
          <div class="gauge-label-bar">
            <span>Prompt Injection Risk</span>
            <span style="font-family: var(--font-mono); color: ${g.promptInjectionRisk > 0.65 ? 'var(--accent-rose)' : 'var(--text-muted)'};">${Math.round(g.promptInjectionRisk * 100)}%</span>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill ${g.promptInjectionRisk > 0.65 ? 'fill-danger' : 'fill-safe'}" style="width: ${Math.round(g.promptInjectionRisk * 100)}%;"></div>
          </div>
        </div>

        <div class="gauge-row">
          <div class="gauge-label-bar">
            <span>Toxicity / Harassment</span>
            <span style="font-family: var(--font-mono); color: ${g.toxicityRisk > 0.70 ? 'var(--accent-rose)' : 'var(--text-muted)'};">${Math.round(g.toxicityRisk * 100)}%</span>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill ${g.toxicityRisk > 0.70 ? 'fill-danger' : 'fill-safe'}" style="width: ${Math.round(g.toxicityRisk * 100)}%;"></div>
          </div>
        </div>

        <div class="gauge-row">
          <div class="gauge-label-bar">
            <span>Credential / PII Exposure</span>
            <span style="font-family: var(--font-mono); color: ${g.piiLeakRisk > 0.70 ? 'var(--accent-rose)' : 'var(--text-muted)'};">${Math.round(g.piiLeakRisk * 100)}%</span>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill ${g.piiLeakRisk > 0.70 ? 'fill-danger' : 'fill-safe'}" style="width: ${Math.round(g.piiLeakRisk * 100)}%;"></div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>🎯 Intent Routing (Choice)</span>
          <span class="conf-badge">${Math.round(c.confidence * 100)}% Conf</span>
        </div>

        <div class="dept-choice-box">
          <div>
            <div style="font-size: 0.7rem; color: var(--text-faint); text-transform: uppercase;">Target Queue</div>
            <div class="dept-name">${v.targetQueue}</div>
          </div>
        </div>

        ${deptBars}
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>🔥 Incident Severity (Score)</span>
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-faint);">${Math.round(d.severity.confidence * 100)}% Conf</span>
        </div>
        <div class="score-display">
          <div class="score-number">${d.severity.score}</div>
          <div class="score-max">/ 3.0</div>
        </div>
        <div class="score-label">${d.severity.levelLabel}</div>
        <div class="gauge-track" style="margin-top: 0.65rem;">
          <div class="gauge-fill ${d.severity.score >= 2.0 ? 'fill-danger' : d.severity.score >= 1.0 ? 'fill-amber' : 'fill-safe'}" style="width: ${(d.severity.score / 3.0) * 100}%;"></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>😡 Churn Risk & Sentiment (Score)</span>
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-faint);">Actionable: ${Math.round(d.isActionable * 100)}%</span>
        </div>
        <div class="score-display">
          <div class="score-number">${d.sentiment.score}</div>
          <div class="score-max">/ 3.0</div>
        </div>
        <div class="score-label">${d.sentiment.levelLabel}</div>
        <div class="gauge-track" style="margin-top: 0.65rem;">
          <div class="gauge-fill ${d.sentiment.score >= 2.0 ? 'fill-danger' : d.sentiment.score >= 1.0 ? 'fill-amber' : 'fill-safe'}" style="width: ${(d.sentiment.score / 3.0) * 100}%;"></div>
        </div>
      </div>
    </div>

    <div class="section-card" style="margin-top: 1rem;">
      <div class="section-card-title">
        <span>⚙️ Deterministic Code Policy Execution Trace</span>
      </div>
      <div class="flow-steps">
        <div class="flow-step passed">1. Ingest Payload</div>
        <span class="flow-arrow">➔</span>
        <div class="flow-step passed">2. Jev Parallel Eval (${d.latencyMs}ms)</div>
        <span class="flow-arrow">➔</span>
        <div class="flow-step ${g.isSafe ? 'passed' : 'triggered'}">3. Guardrail: ${g.isSafe ? 'Passed' : 'VIOLATION'}</div>
        <span class="flow-arrow">➔</span>
        <div class="flow-step ${c.confidence >= 0.70 ? 'passed' : 'triggered'}">4. Confidence Gate: ${Math.round(c.confidence * 100)}%</div>
        <span class="flow-arrow">➔</span>
        <div class="flow-step triggered">5. Dispatch: ${v.action} ➔ ${v.targetQueue}</div>
      </div>
    </div>
  `;

  const resultsBody = document.getElementById('results-body');
  if (resultsBody) {
    resultsBody.innerHTML = html;
  }
}

export function initWorkbench() {
  const form = document.getElementById('triage-form');
  const submitBtn = document.getElementById('btn-submit');
  const btnText = document.getElementById('btn-text');

  if (!form || !submitBtn) return;

  async function handleTriage() {
    const content = document.getElementById('input-content').value.trim();
    const source = document.getElementById('input-source').value.trim() || 'api:direct';

    if (!content) return;

    submitBtn.disabled = true;
    btnText.textContent = 'Evaluating in Jev System 1...';
    document.getElementById('latency-indicator').textContent = 'Processing...';

    try {
      const decision = await executeTriage(content, source);
      renderDecision(decision);

      const metrics = await fetchMetrics();
      updateMetrics(metrics);
    } catch (err) {
      alert('Triage failed: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Execute 7-Dimension Evaluation';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleTriage();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleTriage();
    }
  });
}
