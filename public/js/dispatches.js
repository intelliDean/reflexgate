import { fetchDispatches } from './api.js';

export async function loadDispatches() {
  const tbody = document.getElementById('dispatches-tbody');
  if (!tbody) return;

  try {
    const data = await fetchDispatches();

    if (!data.dispatches || data.dispatches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-faint); padding: 2rem;">No outbound deliveries logged yet. Run a triage to trigger dispatches.</td></tr>';
      return;
    }

    tbody.innerHTML = data.dispatches.map(d => `
      <tr>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${d.id}</td>
        <td style="font-family: var(--font-mono); color: white;">${d.targetQueue}</td>
        <td><span class="badge-sm badge-auto">${d.action}</span></td>
        <td><span class="priority-badge priority-${d.priority.split('_')[0].toLowerCase()}" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">${d.priority}</span></td>
        <td><span class="badge-sm" style="background: rgba(255,255,255,0.06);">${d.destinationType}</span></td>
        <td><span class="badge-sm ${d.status === 'DELIVERED' || d.status === 'SIMULATED' ? 'badge-auto' : 'badge-block'}">${d.status}</span></td>
        <td style="font-family: var(--font-mono);">${d.latencyMs}ms</td>
        <td style="color: var(--text-faint);">${new Date(d.timestamp).toLocaleTimeString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load dispatches:', err);
  }
}

export function initDispatchesTab() {
  const refreshBtn = document.getElementById('btn-refresh-dispatches');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDispatches);
  }
}
