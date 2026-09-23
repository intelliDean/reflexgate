import { TypeSafeClient } from '@typesafe-ai/sdk';
import { GATEWAY_QUESTIONS } from '../questions.js';
import { ITypeSafeEvaluator, EvaluatorResult } from './types.js';
import { normalizeEvaluatorResponse } from './parsers.js';
import dotenv from 'dotenv';

dotenv.config();

export class TypeSafeGatewayEvaluator implements ITypeSafeEvaluator {
  private client: TypeSafeClient;
  private apiKey: string;

  constructor(apiKey?: string, client?: TypeSafeClient) {
    this.apiKey = apiKey || process.env.TYPESAFE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ WARNING: TYPESAFE_API_KEY is not defined. Ensure it is set in .env');
    }
    this.client = client || new TypeSafeClient({
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
      return normalizeEvaluatorResponse(response, latencyMs);
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
      return normalizeEvaluatorResponse(data, latencyMs);
    }
  }
}
