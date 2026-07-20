// ArcGent Core Agent v4 — Drizzle ORM + SQLite
// All persistence goes through the database, not JSON files

import { createConfig, type Config } from "./utils/config.js";
import { RuleEngine } from "./rules/engine.js";
import { CircleWallet } from "./payments/circle.js";
import { GitHubListener } from "./signals/github.js";
import { getApprovalEngine, type ApprovalTier } from "./approval/engine.js";
import { getEvaluator, type AIEvaluation, type SignalContext } from "./ai/evaluator.js";
import { getDb, schema } from "./db/index.js";
import { Logger } from "./utils/logger.js";
import { eq, desc, sql } from "drizzle-orm";

const logger = new Logger("ArcGent");
const { rules, payments, approvals, signals } = schema;

export interface AgentRule {
  id: string; name: string;
  signal: { source: string; trigger: string; conditions: Record<string, any>; };
  action: { type: string; recipient: string; amount: number; currency?: string; memo?: string; };
  enabled: boolean; cooldown?: number;
}

export interface PaymentRecord {
  id: string; ruleId: string; to: string; amount: number;
  status: string; timestamp: string; txHash?: string;
  approvalTier?: string; approvalId?: string;
}

export class ArcGentAgent {
  private config: Config;
  private ruleEngine: RuleEngine;
  public circleWallet!: CircleWallet;
  private githubListener!: GitHubListener;
  private running = false;
  private lastTrigger: Map<string, number> = new Map();
  private signalCheckCount = 0;
  private paymentCount = 0;
  private startTime: Date = new Date();
  private killed = false;
  private db: ReturnType<typeof getDb>;
  
  // Risk management — spending limits
  private dailySpent = 0;
  private dailyResetDate = "";
  private ruleSpentToday: Map<string, number> = new Map();
  
  // Configurable limits (micro-USDC, 1 USDC = 1_000_000)
  public riskLimits = {
    dailyCap: 10_000_000,          // 10 USDC/day total
    perRuleCap: 5_000_000,         // 5 USDC/day per rule
    perTxMax: 2_000_000,           // 2 USDC max per single tx
    cooldownMs: 60_000,            // 1 min between payments per rule
    autoApproveMax: 10_000_000,    // payments under this go AUTO
    requireApprovalAbove: 10_000_000, // payments above this need MANUAL
  };

  constructor(config?: Partial<Config>) {
    this.config = createConfig();
    if (config) Object.assign(this.config, config);
    this.ruleEngine = new RuleEngine();
    this.db = getDb();
    // Track payment count from DB
    const count = this.db.select({ c: sql<number>`count(*)` }).from(payments).get();
    this.paymentCount = count?.c || 0;
  }

  getState() {
    const approval = getApprovalEngine();
    this.resetDailyIfNeeded();
    return {
      status: this.killed ? "KILLED" as const : this.running ? "RUNNING" as const : "STOPPED" as const,
      signalCheckCount: this.signalCheckCount,
      paymentCount: this.paymentCount,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      pendingApprovals: approval.getPending(),
      risk: this.getRiskStatus(),
    };
  }

  /** Risk management status */
  getRiskStatus() {
    this.resetDailyIfNeeded();
    return {
      dailySpent: this.dailySpent,
      dailyCap: this.riskLimits.dailyCap,
      dailyRemaining: Math.max(0, this.riskLimits.dailyCap - this.dailySpent),
      perTxMax: this.riskLimits.perTxMax,
      perRuleCap: this.riskLimits.perRuleCap,
      ruleSpending: Object.fromEntries(this.ruleSpentToday),
      utilization: Math.round((this.dailySpent / this.riskLimits.dailyCap) * 100),
    };
  }

  /** Check if a payment is allowed by risk limits */
  checkRiskLimits(ruleId: string, amount: number): { allowed: boolean; reason?: string } {
    this.resetDailyIfNeeded();
    if (amount > this.riskLimits.perTxMax) {
      return { allowed: false, reason: `Amount ${amount} exceeds per-tx max ${this.riskLimits.perTxMax}` };
    }
    if (this.dailySpent + amount > this.riskLimits.dailyCap) {
      return { allowed: false, reason: `Daily cap reached (${this.dailySpent}/${this.riskLimits.dailyCap})` };
    }
    const ruleSpent = this.ruleSpentToday.get(ruleId) || 0;
    if (ruleSpent + amount > this.riskLimits.perRuleCap) {
      return { allowed: false, reason: `Rule ${ruleId} daily cap reached (${ruleSpent}/${this.riskLimits.perRuleCap})` };
    }
    return { allowed: true };
  }

  /** Record a payment against risk limits */
  recordSpending(ruleId: string, amount: number) {
    this.resetDailyIfNeeded();
    this.dailySpent += amount;
    this.ruleSpentToday.set(ruleId, (this.ruleSpentToday.get(ruleId) || 0) + amount);
  }

  /** Reset daily counters at midnight UTC */
  private resetDailyIfNeeded() {
    const today = new Date().toISOString().split("T")[0];
    if (this.dailyResetDate !== today) {
      this.dailySpent = 0;
      this.ruleSpentToday.clear();
      this.dailyResetDate = today;
    }
  }

  getRules() {
    return this.db.select().from(rules).orderBy(desc(rules.createdAt)).all();
  }

  getPayments() {
    return this.db.select().from(payments).orderBy(desc(payments.createdAt)).all();
  }

  async getBalance(): Promise<string> {
    if (!this.circleWallet) return "0.00";
    try { return await this.circleWallet.getBalance(); } catch { return "0.00"; }
  }

  // --- Kill Switch ---
  kill() {
    this.killed = true;
    this.running = false;
    this.githubListener?.stop();
    logger.info("🔴 KILL SWITCH ACTIVATED");
  }

  revive() {
    this.killed = false;
    this.running = true;
    this.evaluationLoop();
    logger.info("🟢 Agent revived");
  }

  // --- Rules CRUD via DB ---
  addRule(rule: AgentRule) {
    if (!rule.id) rule.id = `rule_${Date.now()}`;
    this.db.insert(rules).values({
      id: rule.id,
      ownerAddress: (rule as any).ownerAddress || "0x0",
      name: rule.name,
      signalSource: rule.signal.source,
      signalTrigger: rule.signal.trigger,
      signalConditions: rule.signal.conditions || {},
      actionType: rule.action.type,
      actionRecipient: rule.action.recipient,
      actionAmount: rule.action.amount,
      actionCurrency: rule.action.currency || "USDC",
      actionMemo: rule.action.memo || null,
      enabled: rule.enabled !== false,
      cooldown: rule.cooldown || null,
    }).onConflictDoNothing().run();
    logger.info(`Rule added: ${rule.name} (${rule.id})`);
    return rule;
  }

  updateRule(id: string, updates: Partial<AgentRule>) {
    const data: Record<string, any> = { updatedAt: new Date() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    if (updates.cooldown !== undefined) data.cooldown = updates.cooldown;
    if (updates.action?.amount !== undefined) data.actionAmount = updates.action.amount;
    if (updates.action?.recipient !== undefined) data.actionRecipient = updates.action.recipient;
    if (updates.signal?.trigger !== undefined) data.signalTrigger = updates.signal.trigger;
    if (updates.signal?.conditions !== undefined) data.signalConditions = updates.signal.conditions;

    const result = this.db.update(rules).set(data).where(eq(rules.id, id)).running();
    if (result.changes === 0) return null;
    return this.db.select().from(rules).where(eq(rules.id, id)).get();
  }

  toggleRule(id: string) {
    const rule = this.db.select({ enabled: rules.enabled, name: rules.name }).from(rules).where(eq(rules.id, id)).get();
    if (!rule) return null;
    const newEnabled = !rule.enabled;
    this.db.update(rules).set({ enabled: newEnabled, updatedAt: new Date() }).where(eq(rules.id, id)).run();
    logger.info(`Rule ${rule.name}: ${newEnabled ? "ON" : "OFF"}`);
    return this.db.select().from(rules).where(eq(rules.id, id)).get();
  }

  // --- Webhook ---
  handleWebhook(source: string, trigger: string, data: Record<string, any>) {
    this.signalCheckCount++;
    const matchingRules = this.db.select().from(rules)
      .where(eq(rules.signalSource, "webhook")).all()
      .filter(r => r.signalTrigger === `${source}.${trigger}` && r.enabled);

    for (const rule of matchingRules) {
      if (this.isOnCooldown(rule)) continue;
      const evaluation = this.ruleEngine.evaluateRule(
        { id: rule.id, name: rule.name, signal: { source: rule.signalSource, trigger: rule.signalTrigger, conditions: rule.signalConditions }, action: { type: rule.actionType, recipient: rule.actionRecipient, amount: rule.actionAmount }, enabled: rule.enabled },
        data
      );
      if (evaluation.approved) {
        this.executePayment(rule);
        this.lastTrigger.set(rule.id, Date.now());
      }
    }
    return { matched: matchingRules.length, triggered: matchingRules.length };
  }

  // --- AI Evaluation ---
  async evaluateWithAI(ruleId: string, context: SignalContext) {
    const evaluator = getEvaluator(this.config);
    const evaluation = await evaluator.evaluate(context);

    // Store in DB
    const evalId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.insert(schema.aiEvaluations).values({
      id: evalId, ruleId,
      type: context.type,
      context: context,
      approved: evaluation.approved,
      amount: evaluation.amount,
      confidence: evaluation.confidence,
      severity: evaluation.severity,
      reasoning: evaluation.reasoning,
      tokensUsed: evaluation.metadata?.tokens as number,
      responseTime: evaluation.metadata?.responseTime as number,
    }).run();

    if (evaluation.approved && evaluation.confidence >= 80) {
      const rule = this.db.select().from(rules).where(eq(rules.id, ruleId)).get();
      if (rule) {
        const txHash = await this.executePayment(rule, evaluation);
        return { ...evaluation, paymentTx: txHash };
      }
    }
    return evaluation;
  }

  // --- Payment Execution ---
  async evaluateSignal(source: string, trigger: string, metadata: Record<string, any>): Promise<AIEvaluation> {
    const evaluator = getEvaluator(this.config);
    const context: SignalContext = {
      type: `${source}/${trigger}`,
      title: `${source}:${trigger}`,
      description: JSON.stringify(metadata || {}).slice(0, 200),
      rawData: metadata || {},
      source,
      trigger,
      data: metadata,
      timestamp: new Date().toISOString(),
    } as any;
    return evaluator.evaluate(context);
  }

  async executePaymentSimple(to: string, amount: number, memo?: string): Promise<string> {
    if (this.killed) throw new Error("Agent is KILLED — payments blocked");
    if (!this.circleWallet) throw new Error("Wallet not initialized");

    const isNano = amount < 10000;
    const txHash = isNano
      ? await this.circleWallet.sendNanopayment(to, Math.ceil(amount), memo)
      : await this.circleWallet.sendUSDC(to, amount / 1e6, memo);

    const payId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.insert(payments).values({
      id: payId, ownerAddress: "0x0", ruleId: "simulate",
      to, amount,
      status: "confirmed", type: isNano ? "nanopayment" : "payment",
      memo: memo || null,
      txHash,
      confirmedAt: new Date(),
    }).onConflictDoNothing().run();

    this.paymentCount++;
    logger.info(`💸 Simulated payment: ${(amount / 1e6).toFixed(6)} USDC → ${to.slice(0, 10)}...`);
    return txHash;
  }

  async executePayment(_rule: any, aiEval?: AIEvaluation): Promise<string> {
    if (this.killed) throw new Error("Agent is KILLED — payments blocked");
    if (!this.circleWallet) throw new Error("Wallet not initialized");

    const amount = aiEval?.amount || _rule.actionAmount;
    const recipient = _rule.actionRecipient;
    
    try {
      // Determine if nanopayment (< 0.01 USDC = 10000 micro-USDC)
      const isNano = amount < 10000;
      const txHash = isNano
        ? await this.circleWallet.sendNanopayment(recipient, Math.ceil(amount), _rule.actionMemo)
        : await this.circleWallet.sendUSDC(recipient, amount / 1e6, _rule.actionMemo);

      // Store payment in DB
      const payId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.db.insert(payments).values({
        id: payId, ruleId: _rule.id || null,
        to: recipient, amount,
        status: "confirmed", type: isNano ? "nanopayment" : "payment",
        memo: _rule.actionMemo,
        txHash,
        approvalTier: aiEval ? (aiEval.confidence >= 80 ? "auto" : "review") : "auto",
        aiEvaluation: aiEval || null,
        confirmedAt: new Date(),
      }).run();

      this.paymentCount++;
      logger.info(`💸 Payment sent: ${(amount / 1e6).toFixed(6)} USDC → ${recipient.slice(0, 10)}...`);
      return txHash;
    } catch (error: any) {
      // Store failed payment
      this.db.insert(payments).values({
        id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ruleId: _rule.id || null, to: recipient, amount,
        status: "failed", memo: error.message,
      }).run();
      throw error;
    }
  }

  // --- Signal Logging ---
  logSignal(source: string, trigger: string, rawData: Record<string, any>, ruleId?: string) {
    this.signalCheckCount++;
    this.db.insert(signals).values({
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source, trigger, rawData, processed: true, ruleId: ruleId || null,
    }).run();
  }

  // --- Lifecycle ---
  async start() {
    if (this.running) return;
    this.running = true;
    
    // Initialize wallet
    this.circleWallet = new CircleWallet(this.config);
    await this.circleWallet.initialize();
    await this.circleWallet.getBalance();

    // Start GitHub listener
    const ghRepos = this.config.githubRepos || [];
    if (ghRepos.length > 0 && this.config.githubToken) {
      this.githubListener = new GitHubListener(this.config.githubToken, ghRepos);
      this.githubListener.on("signal", (signal) => this.handleGitHubSignal(signal));
      this.githubListener.start();
    }

    this.evaluationLoop();
    logger.info("🤖 ArcGent is running. Monitoring signals...");
  }

  private async handleGitHubSignal(signal: { action: string; repo: string; metadata?: any }) {
    this.signalCheckCount++;
    this.logSignal("github", signal.action, signal.metadata || {}, undefined);

    const matchingRules = this.db.select().from(rules)
      .where(eq(rules.signalSource, "github")).all()
      .filter(r => r.signalTrigger === signal.action && r.enabled);

    for (const rule of matchingRules) {
      if (this.isOnCooldown(rule)) continue;
      this.executePayment(rule);
      this.lastTrigger.set(rule.id, Date.now());
    }
  }

  private isOnCooldown(rule: any): boolean {
    const last = this.lastTrigger.get(rule.id);
    return last !== undefined && rule.cooldown && (Date.now() - last < rule.cooldown * 1000);
  }

  private evaluationLoop() {
    setInterval(() => {
      if (!this.running || this.killed) return;
      this.signalCheckCount++;
    }, 10000);
  }
}

// Singleton
let _agent: ArcGentAgent | null = null;
export function getAgent(config?: Partial<Config>): ArcGentAgent {
  if (!_agent) _agent = new ArcGentAgent(config);
  return _agent;
}
