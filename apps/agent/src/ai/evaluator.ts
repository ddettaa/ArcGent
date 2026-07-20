// ArcGent AI Evaluator — LLM-powered decision engine
// Uses 9Router for bug bounty, content quality, dispute resolution
// "Not IF/THEN — the agent REASONS about what to pay"

import type { Config } from "../utils/config.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("AI");

export interface AIEvaluation {
  approved: boolean;
  amount: number;
  confidence: number; // 0-100
  reasoning: string;
  severity?: "critical" | "high" | "medium" | "low" | "trivial";
  model: string;
  tokensUsed?: number;
}

export interface SignalContext {
  type: string;                // "bug_bounty" | "content_review" | "dispute" | "generic"
  title: string;
  description: string;
  rawData: Record<string, any>;
}

// --- PROMPT TEMPLATES ---

const PROMPTS: Record<string, string> = {
  bug_bounty: `You are a bug bounty evaluator for an autonomous payment agent. Analyze the pull request and decide the reward.

RULES:
- Critical vulnerability (exploit, fund loss): $200-500
- High severity (data leak, bypass): $100-200
- Medium severity (logic bug): $25-100
- Low severity (UI fix, typo): $1-25
- Spam / no real change: $0 (reject)
- First-time contributor: +10% bonus
- Trusted contributor (>5 PRs): +20% bonus

Respond ONLY with valid JSON:
{
  "approved": true/false,
  "amount": number (USDC),
  "confidence": 0-100,
  "severity": "critical"|"high"|"medium"|"low"|"trivial",
  "reasoning": "brief explanation of decision"
}`,

  content_review: `You are a content quality evaluator for an autonomous payment agent. Analyze the submitted content.

RULES:
- Original research/analysis (2000+ words): $50-200
- Tutorial/guide (1000+ words): $25-100
- Opinion/commentary: $5-25
- Copied/plagiarized: $0 (reject)
- Spam/low effort: $0 (reject)
- Original images/charts: +$10 each

Respond ONLY with valid JSON:
{
  "approved": true/false,
  "amount": number (USDC),
  "confidence": 0-100,
  "severity": "high"|"medium"|"low"|"trivial",
  "reasoning": "brief explanation of decision"
}`,

  dispute: `You are a dispute resolution agent. Analyze the freelancer-client dispute and decide fair payment.

RULES:
- If deliverable matches spec >80%: pay full amount
- If deliverable matches spec 50-80%: partial payment proportional to completion
- If deliverable matches spec <50%: no payment
- If client is unreasonable (clear spec, good deliverable): pay full
- If freelancer clearly underdelivered: no payment or partial

Respond ONLY with valid JSON:
{
  "approved": true/false,
  "amount": number (USDC) — how much of the escrow to release,
  "confidence": 0-100,
  "severity": "high"|"medium"|"low",
  "reasoning": "brief explanation of decision"
}`,

  generic: `You are an autonomous payment agent. Evaluate the signal and decide whether to pay and how much.

Respond ONLY with valid JSON:
{
  "approved": true/false,
  "amount": number (USDC),
  "confidence": 0-100,
  "reasoning": "brief explanation of decision"
}`,
};

// --- LLM EVALUATOR ---

export class LLMEvaluator {
  private llmBaseUrl: string;
  private llmApiKey: string;
  private llmModel: string;
  private cache: Map<string, AIEvaluation> = new Map();
  private stats = { calls: 0, totalTokens: 0, avgConfidence: 0, avgTime: 0 };

  constructor(config?: Config) {
    this.llmBaseUrl = config?.llmBaseUrl || process.env.LLM_BASE_URL || "";
    this.llmApiKey = config?.llmApiKey || process.env.LLM_API_KEY || "";
    this.llmModel = config?.llmModel || process.env.LLM_MODEL || "btlbagus";
  }

  getStats() {
    return { ...this.stats, avgConfidence: this.stats.calls > 0 ? Math.round(this.stats.avgConfidence / this.stats.calls) : 0 };
  }

  async evaluate(signal: SignalContext): Promise<AIEvaluation> {
    const title = signal.title || signal.type || "signal";
    const desc = (signal.description || JSON.stringify(signal.data || {})).slice(0, 100);
    const cacheKey = `${signal.type}:${title}:${desc}`;
    if (this.cache.has(cacheKey)) {
      logger.info(`Cache hit for: ${signal.title}`);
      return this.cache.get(cacheKey)!;
    }

    if (!this.llmBaseUrl || !this.llmApiKey) {
      logger.warn("LLM not configured — falling back to rule engine");
      return this.fallback(signal);
    }

    const prompt = PROMPTS[signal.type] || PROMPTS.generic;
    const fullPrompt = `${prompt}

SIGNAL DATA:
Title: ${title}
Description: ${desc}
Source: ${signal.source || "unknown"} / ${signal.trigger || "unknown"}
Raw Data: ${JSON.stringify(signal.data || {}, null, 2)}

Your evaluation (JSON only):`;

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [
            { role: "system", content: "You are an autonomous payment agent. Respond ONLY with valid JSON. No explanations outside the JSON." },
            { role: "user", content: fullPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "unknown");
        logger.error(`LLM API error ${response.status}: ${errText.slice(0, 200)}`);
        return this.fallback(signal);
      }

      const data = await response.json();
      // Handle reasoning models: content may be empty, answer in reasoning_content
      let content = data.choices?.[0]?.message?.content || "";
      if (!content && data.choices?.[0]?.message?.reasoning_content) {
        content = data.choices[0].message.reasoning_content;
        logger.info("Used reasoning_content (content was empty)");
      }
      const tokensUsed = data.usage?.total_tokens || 0;

      // Extract JSON from response
      // Try strict first, then lenient (handles truncated/streaming output)
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Lenient: grab from first { to last }
        const first = content.indexOf("{");
        const last = content.lastIndexOf("}");
        if (first >= 0 && last > first) {
          jsonMatch = [content.slice(first, last + 1)];
        }
      }
      if (!jsonMatch) {
        // Last resort: complete partial JSON by adding closing braces
        const partial = content.match(/\{[\s\S]*/);
        if (partial) {
          let attempt = partial[0];
          // Count open vs close braces
          let open = (attempt.match(/\{/g) || []).length;
          let close = (attempt.match(/\}/g) || []).length;
          while (close < open) { attempt += "}"; close++; }
          open = (attempt.match(/\[/g) || []).length;
          close = (attempt.match(/\]/g) || []).length;
          while (close < open) { attempt += "]"; close++; }
          jsonMatch = [attempt];
        }
      }
      if (!jsonMatch) {
        logger.error(`No JSON in LLM response: ${content.slice(0, 200)}`);
        return this.fallback(signal);
      }

      const evaluation: AIEvaluation = JSON.parse(jsonMatch[0]);
      evaluation.model = this.llmModel;
      evaluation.tokensUsed = tokensUsed;

      // Clamp values
      evaluation.confidence = Math.max(0, Math.min(100, evaluation.confidence));
      evaluation.amount = Math.max(0, evaluation.amount);

      const elapsed = Date.now() - startTime;
      this.stats.calls++;
      this.stats.totalTokens += tokensUsed;
      this.stats.avgConfidence += evaluation.confidence;
      this.stats.avgTime = ((this.stats.avgTime * (this.stats.calls - 1)) + elapsed) / this.stats.calls;

      this.cache.set(cacheKey, evaluation);

      logger.info(
        `AI eval: ${evaluation.approved ? "✅" : "❌"} ${evaluation.amount} USDC ` +
        `(${evaluation.severity || "N/A"}, ${evaluation.confidence}% confidence, ${elapsed}ms)`
      );

      return evaluation;
    } catch (error) {
      logger.error(`LLM call failed: ${error}`);
      return this.fallback(signal);
    }
  }

  private fallback(signal: SignalContext): AIEvaluation {
    // Safe default: reject with low confidence
    return {
      approved: false,
      amount: 0,
      confidence: 0,
      reasoning: "LLM unavailable — fell back to safe default (reject)",
      severity: "low",
      model: "fallback",
    };
  }
}

// Singleton
let _evaluator: LLMEvaluator | null = null;
export function getEvaluator(config?: Config): LLMEvaluator {
  if (!_evaluator) _evaluator = new LLMEvaluator(config);
  return _evaluator;
}
