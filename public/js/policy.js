import { fetchPolicyConfig, updatePolicyConfig } from './api.js';

export function initPolicyTab() {
  const rangeInj = document.getElementById('range-injection');
  const rangeTox = document.getElementById('range-toxicity');
  const rangeConf = document.getElementById('range-confidence');
  const rangeSev = document.getElementById('range-severity');
  const saveBtn = document.getElementById('btn-save-policy');

  if (!rangeInj || !saveBtn) return;

  rangeInj.oninput = () => document.getElementById('val-injection').textContent = `${rangeInj.value}%`;
  rangeTox.oninput = () => document.getElementById('val-toxicity').textContent = `${rangeTox.value}%`;
  rangeConf.oninput = () => document.getElementById('val-confidence').textContent = `${rangeConf.value}%`;
  rangeSev.oninput = () => document.getElementById('val-severity').textContent = `${(rangeSev.value / 10).toFixed(1)} / 3.0`;

  saveBtn.addEventListener('click', async () => {
    const payload = {
      promptInjectionThreshold: Number(rangeInj.value) / 100,
      toxicityThreshold: Number(rangeTox.value) / 100,
      autoDispatchConfidenceMin: Number(rangeConf.value) / 100,
      criticalSeverityMin: Number(rangeSev.value) / 10,
      slackWebhookUrl: document.getElementById('cfg-slack').value.trim(),
      genericWebhookUrl: document.getElementById('cfg-generic').value.trim(),
      enableMockDownstream: document.getElementById('cfg-mock').checked,
    };

    try {
      await updatePolicyConfig(payload);
      alert('✅ Policy rules updated and persisted to SQLite successfully!');
    } catch (err) {
      alert('Failed to save policy: ' + err.message);
    }
  });
}

export async function loadPolicyConfig() {
  const rangeInj = document.getElementById('range-injection');
  const rangeTox = document.getElementById('range-toxicity');
  const rangeConf = document.getElementById('range-confidence');
  const rangeSev = document.getElementById('range-severity');

  if (!rangeInj) return;

  try {
    const cfg = await fetchPolicyConfig();
    rangeInj.value = Math.round(cfg.promptInjectionThreshold * 100);
    rangeTox.value = Math.round(cfg.toxicityThreshold * 100);
    rangeConf.value = Math.round(cfg.autoDispatchConfidenceMin * 100);
    rangeSev.value = Math.round(cfg.criticalSeverityMin * 10);

    document.getElementById('val-injection').textContent = `${rangeInj.value}%`;
    document.getElementById('val-toxicity').textContent = `${rangeTox.value}%`;
    document.getElementById('val-confidence').textContent = `${rangeConf.value}%`;
    document.getElementById('val-severity').textContent = `${(rangeSev.value / 10).toFixed(1)} / 3.0`;

    document.getElementById('cfg-slack').value = cfg.slackWebhookUrl || '';
    document.getElementById('cfg-generic').value = cfg.genericWebhookUrl || '';
    document.getElementById('cfg-mock').checked = cfg.enableMockDownstream !== false;
  } catch (err) {
    console.error('Failed to load policy config:', err);
  }
}
