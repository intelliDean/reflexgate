export type DestinationType = 'mock_local' | 'slack_discord' | 'generic_webhook';
export type DispatchStatus = 'DELIVERED' | 'FAILED' | 'SIMULATED';

export interface DispatchLog {
  id: string;
  requestId: string;
  targetQueue: string;
  action: string;
  priority: string;
  destinationType: DestinationType;
  destinationUrl?: string;
  status: DispatchStatus;
  statusCode?: number;
  error?: string;
  latencyMs: number;
  timestamp: string;
  payloadSummary: string;
}

export interface HttpRequestResult {
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}
