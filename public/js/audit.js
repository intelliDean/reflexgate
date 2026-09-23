import { fetchAuditHistory } from './api.js';

export async function loadAuditHistory() {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  const action = document.getElementById('filter-action')?.value || 'ALL';
  const priority = document.getElementById('filter-priority')?.value || 'ALL';
  const dept = document.getElementById('filter-dept')?.value || 'ALL';
  const search = document.getElementById('filter-search')?.value.trim() || '';

  const params = new URLSearchParams();
  if (action !== 'ALL') params.append('action', action);
  if (priority !== 'ALL') params.append('priority', priority);
  if (dept !== 'ALL') params.append('department', dept);
  if (search) params.append('search', search);

  try {
    const data = await fetchAuditHistory(params);

    if (!data.decisions || data.decisions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-faint); padding: 2rem;">No matching records found in SQLite database.</td></tr>';
      return;
    }

    tbody.innerHTML = data.decisions.map(item => {
      const v = item.verdict;
      const badgeClass = 
        v.action === 'AUTO_DISPATCH' ? 'badge-auto' :
        v.action === 'SECURITY_BLOCK' ? 'badge-block' :
        v.action === 'ESCALATE_CRITICAL' ? 'badge-escalate' : 'badge-review';

      const time = new Date(item.evaluatedAt).toLocaleTimeString();
      const snippet = item.summaryReason || '';

      return `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">${item.requestId}</td>
          <td><span class="badge-sm" style="background: rgba(255,255,255,0.06);">${item.source}</span></td>
          <td><span class="badge-sm ${badgeClass}">${v.action}</span></td>
          <td style="font-family: var(--font-mono); color: white;">${v.targetQueue}</td>
          <td><span class="priority-badge priority-${v.priority.split('_')[0].toLowerCase()}" style="font-size: 0.68rem; padding: 0.15rem 0.4rem;">${v.priority}</span></td>
          <td style="font-family: var(--font-mono);">${Math.round(item.classification.confidence * 100)}%</td>
          <td style="font-family: var(--font-mono);">${item.latencyMs}ms</td>
          <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 0.78rem;">${snippet}</td>
          <td style="color: var(--text-faint);">${time}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load audit history:', err);
  }
}

export function initAuditTab() {
  const applyBtn = document.getElementById('btn-apply-filters');
  const refreshBtn = document.getElementById('btn-refresh-audit');

  if (applyBtn) applyBtn.addEventListener('click', loadAuditHistory);
  if (refreshBtn) refreshBtn.addEventListener('click', loadAuditHistory);
}
