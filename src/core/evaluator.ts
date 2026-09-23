import { TypeSafeClient } from '@typesafe-ai/sdk';
import { GATEWAY_QUESTIONS } from './questions.js';
import dotenv from 'dotenv';

dotenv.config();

export interface EvaluatorResult {
  latencyMs: number;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  answers: {
    prompt_injection: { type: 'noul'; noul: number };
    toxicity: { type: 'noul'; noul: number };
    pii_leak: { type: 'noul'; noul: number };
    department: {
      type: 'choice';
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    };
    severity: {
      type: 'score';
      score: number;
      confidence: number;
      legend: Record<string, string>;
      probabilities: Record<string, number>;
    };
    sentiment: {
      type: 'score';
      score: number;
      confidence: number;
      legend: Record<string, string>;
      probabilities: Record<string, number>;
    };
    is_actionable: { type: 'noul'; noul: number };
  };
}

export class TypeSafeGatewayEvaluator {
  private client: TypeSafeClient;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TYPESAFE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ WARNING: TYPESAFE_API_KEY is not defined. Ensure it is set in .env');
    }
    this.client = new TypeSafeClient({
      apiKey: this.apiKey
    });
  }

  /**
   * Evaluates a payload across 7 parallel dimensions using TypeSafe System One (Jev).
   * Runs in a single sub-100ms round-trip.
   */
  async evaluate(state: string | Record<string, any>): Promise<EvaluatorResult> {
    const startTime = performance.now();

    try {
      // Evaluate all questions in parallel against the state in ONE request
      const response = await this.client.systemOne({
        state,
        model: 'jev-latest',
        questions: GATEWAY_QUESTIONS
      });

      const latencyMs = Math.round(performance.now() - startTime);

      return {
        latencyMs,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        answers: response.answers as any
      };
    } catch (err: any) {
      // Robust direct HTTP fallback if SDK throws unexpected client-side error
      console.warn(`[Evaluator] SDK call fallback to HTTP POST: ${err.message}`);
      const directStart = performance.now();
      
      const res = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state,
          model: 'jev-latest',
          questions: GATEWAY_QUESTIONS
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`TypeSafe API request failed (${res.status}): ${errorText}`);
      }

      const data = await res.json() as any;
      const latencyMs = Math.round(performance.now() - directStart);

      return {
        latencyMs,
        model: data.model,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0
        },
        answers: data.answers
      };
    }
  }
}
