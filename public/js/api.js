/**
 * API client for ReflexGate backend endpoints.
 */

export async function fetchPresets() {
  const res = await fetch('/api/v1/presets');
  if (!res.ok) throw new Error('Failed to fetch presets');
  return res.json();
}

export async function fetchMetrics() {
  const res = await fetch('/api/v1/metrics');
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function executeTriage(content, source = 'api:direct') {
  const res = await fetch('/api/v1/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, source })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned ${res.status}`);
  }

  return res.json();
}

export async function fetchPolicyConfig() {
  const res = await fetch('/api/v1/config');
  if (!res.ok) throw new Error('Failed to fetch policy config');
  return res.json();
}

export async function updatePolicyConfig(payload) {
  const res = await fetch('/api/v1/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update policy config');
  }

  return res.json();
}

export async function fetchDispatches() {
  const res = await fetch('/api/v1/dispatches');
  if (!res.ok) throw new Error('Failed to fetch dispatches');
  return res.json();
}

export async function fetchAuditHistory(params = new URLSearchParams()) {
  const res = await fetch(`/api/v1/history?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch audit history');
  return res.json();
}
