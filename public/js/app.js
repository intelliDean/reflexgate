import { fetchPresets, fetchMetrics } from './api.js';
import { initWorkbench, renderPresets, updateMetrics } from './workbench.js';
import { initPolicyTab, loadPolicyConfig } from './policy.js';
import { initDispatchesTab, loadDispatches } from './dispatches.js';
import { initAuditTab, loadAuditHistory } from './audit.js';

function initNavigation() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const targetTab = document.getElementById(tabId);
      if (targetTab) {
        targetTab.classList.add('active');
      }

      if (tabId === 'tab-audit') loadAuditHistory();
      if (tabId === 'tab-dispatches') loadDispatches();
      if (tabId === 'tab-policy') loadPolicyConfig();
    });
  });
}

async function initApp() {
  initNavigation();
  initWorkbench();
  initPolicyTab();
  initDispatchesTab();
  initAuditTab();

  try {
    const [presets, metrics] = await Promise.all([
      fetchPresets(),
      fetchMetrics()
    ]);

    renderPresets(presets);
    updateMetrics(metrics);
    loadPolicyConfig();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', initApp);
