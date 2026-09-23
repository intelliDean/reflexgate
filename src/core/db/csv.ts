/**
 * Pure CSV serializer with RFC-4180 double-quote escaping.
 */
export function formatRowsToCsv(rows: Record<string, any>[]): string {
  const defaultHeader = 'id,source,evaluated_at,action,target_queue,priority,department,confidence,severity,sentiment,risk_score,latency_ms,summary,snippet\n';

  if (!rows || rows.length === 0) {
    return defaultHeader;
  }

  const headers = Object.keys(rows[0]).join(',');
  const lines = rows.map(row => {
    return Object.values(row).map(val => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });

  return [headers, ...lines].join('\n');
}
