export type Department = 
  | 'technical_support' 
  | 'billing_inquiries' 
  | 'sales_and_leads' 
  | 'security_incident' 
  | 'general_feedback';

export type TriageAction = 
  | 'AUTO_DISPATCH'      // High confidence: immediately execute downstream action
  | 'HUMAN_REVIEW'       // Low/Medium confidence: queue for operator approval
  | 'SECURITY_BLOCK'     // Guardrail violation: block request and quarantine
  | 'ESCALATE_CRITICAL'; // High urgency/outage score: trigger instant PagerDuty / alert

export interface TriageRequestPayload {
  id?: string;
  source?: string;       // e.g., 'webhook:zendesk', 'api:chat', 'email:support'
  timestamp?: string;
  content: string | Record<string, any>;
  metadata?: Record<string, any>;
}

export interface GuardrailResults {
  promptInjectionRisk: number;   // 0.0 - 1.0 (Noul)
  toxicityRisk: number;          // 0.0 - 1.0 (Noul)
  piiLeakRisk: number;           // 0.0 - 1.0 (Noul)
  isSafe: boolean;
  violations: string[];
}

export interface DepartmentClassification {
  selected: Department;
  confidence: number;            // 0.0 - 1.0 (Calibrated Confidence)
  probabilities: Record<Department, number>;
}

export interface SeverityRating {
  score: number;                 // 0.0 - 3.0 (Continuous weighted Score)
  confidence: number;
  levelLabel: string;
  probabilities: Record<string, number>;
}

export interface SentimentAnalysis {
  score: number;                 // 0.0 - 3.0 (Frustration / Churn scale)
  confidence: number;
  levelLabel: string;
  probabilities: Record<string, number>;
}

export interface GatewayDecision {
  requestId: string;
  source: string;
  receivedAt: string;
  evaluatedAt: string;
  latencyMs: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  guardrails: GuardrailResults;
  classification: DepartmentClassification;
  severity: SeverityRating;
  sentiment: SentimentAnalysis;
  isActionable: number;          // Noul: probability content contains clear actionable request
  verdict: {
    action: TriageAction;
    targetQueue: string;
    priority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_NORMAL' | 'P4_LOW';
    compositeRiskScore: number;  // 0 - 100 calculated in code
    summaryReason: string;
    routingTags: string[];
  };
  rawAnswers: Record<string, any>;
}

export interface GatewayMetrics {
  totalProcessed: number;
  totalBlocked: number;
  totalAutoDispatched: number;
  totalHumanReview: number;
  totalCriticalEscalated: number;
  averageLatencyMs: number;
  recentDecisions: GatewayDecision[];
}
