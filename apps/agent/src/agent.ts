// ArcGent Core Agent v3
// "If this, then pay" — autonomous signal-to-payment agent
// With 3-tier approval, webhooks, kill switch, persistent history

import { createConfig, type Config } from "./utils/config.js";
import { RuleEngine } from "./rules/engine.js";
import { CircleWallet } from "./payments/circle.js";
import { GitHubListener, type GitHubSignal } from "./signals/github.js";
import { APISignal } from "./signals/api.js";
import { getApprovalEngine, type ApprovalRequest, type ApprovalTier } from "./approval/engine.js";
import { getSignalManager } from "./signals/real.js";
import { getEvaluator, type AIEvaluation, type SignalContext } from "./ai/evaluator.js";
import { Logger } from "./utils/logger.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const logger = new Logger("ArcGent");

export interface AgentRule {
  id: string;
  name: string;
  signal: {
    source: "github" | "api" | "webhook" | "oracle" | "ai";
    trigger: string;
    conditions: Record<string, any>;
  };
  action: {
    type: "pay" | "tip" | "refund";
    recipient: string;
    amount: number;
    currency?: "USDC";
    memo?: string;
  };
  enabled: boolean;
  cooldown?: number;
}

export interface PaymentRecord {
  id: string;
  ruleId: string;
  to: string;
  amount: number;
  status: "pending" | "confirmed" | "failed" | "review" | "manual";
  timestamp: string;
  txHash?: string;
  approvalTier?: ApprovalTier;
  approvalId?: string;
}

export class ArcGentAgent {
  private config: Config;
  private rules: AgentRule[] = [];
  private payments: PaymentRecord[] = [];
  private ruleEngine: RuleEngine;
  public circleWallet!: CircleWallet;
  private githubListener!: GitHubListener;
  private apiSignal!: APISignal;
  private running = false;
  private lastTrigger: Map<string, number> = new Map();
  private signalCheckCount = 0;
  private paymentCount = 0;
  private startTime: Date = new Date();
  private killed = false;

  constructor(config?: Partial<Config>) {
    this.config = createConfig();
    if (config) Object.assign(this.config, config);
    this.ruleEngine = new RuleEngine();
  }

  getState() {
    const approval = getApprovalEngine();
    return {
      status: this.killed ? "KILLED" as const : this.running ? "RUNNING" as const : "STOPPED" as const,
      rules: this.rules,
      payments: this.payments,
      signalCheckCount: this.signalCheckCount,
      paymentCount: this.paymentCount,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      pendingApprovals: approval.getPending(),
    };
  }

  getRules(): AgentRule[] { return this.rules; }
  getPayments(): PaymentRecord[] { return this.payments; }

  async getBalance(): Promise<string> {
    if (!this.circleWallet) return "0.00";
    try { return await this.circleWallet.getBalance(); } catch { return "0.00"; }
  }

  // --- Kill Switch ---
  kill() {
    this.killed = true;
    this.running = false;
    this.githubListener?.stop();
    logger.info("🔴 KILL SWITCH ACTIVATED — all payments stopped");
  }

  revive() {
    this.killed = false;
    this.running = true;
    this.evaluationLoop();
    logger.info("🟢 Agent revived — payments resumed");
  }

  // --- Rules CRUD ---
  addRule(rule: AgentRule): AgentRule {
    if (!rule.id) rule.id = `rule_${Date.now()}`;
    this.rules.push(rule);
    this.saveRules();
    logger.info(`Rule added: ${rule.name} (${rule.id})`);
    return rule;
  }

  updateRule(id: string, updates: Partial<AgentRule>): AgentRule | null {
    const idx = this.rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.rules[idx] = { ...this.rules[idx], ...updates };
    this.saveRules();
    return this.rules[idx];
  }

  toggleRule(id: string): AgentRule | null {
    const rule = this.rules.find(r => r.id === id);
    if (!rule) return null;
    rule.enabled = !rule.enabled;
    this.saveRules();
    logger.info(`Rule ${rule.name}: ${rule.enabled ? "ON" : "OFF"}`);
    return rule;
  }

  // --- Webhook Handler ---
  handleWebhook(source: string, trigger: string, data: Record<string, any>) {
    this.signalCheckCount++;
    logger.info(`📡 Webhook received: ${source}/${trigger}`);

    const matchingRules = this.rules.filter(r =>
      r.enabled &&
      r.signal.source === "webhook" &&
      r.signal.trigger === `${source}.${trigger}`
    );

    for (const rule of matchingRules) {
      if (this.isOnCooldown(rule)) continue;

      const evaluation = this.ruleEngine.evaluateRule(rule, data);
      if (evaluation.approved) {
        logger.info(`🎯 Webhook matched: ${rule.name}`);
        this.executePayment(rule);
        this.lastTrigger.set(rule.id, Date.now());
      }
    }

    return { matched: matchingRules.length, triggered: matchingRules.length };
  }

  // --- AI Signal Evaluation ---
  async evaluateWithAI(
    ruleId: string,
    context: SignalContext
  ): Promise<AIEvaluation & { paymentTx?: string }> {
    const evaluator = getEvaluator(this.config);
    const evaluation = await evaluator.evaluate(context);

    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) {
      return { ...evaluation, paymentTx: undefined };
    }

    // Log the AI decision
    logger.info(
      `🧠 AI Decision: ${evaluation.approved ? "PAY" : "REJECT"} — ` +
      `${evaluation.amount} USDC (${evaluation.confidence}% confidence, ${evaluation.severity}) — ` +
      `${evaluation.reasoning.slice(0, 80)}`
    );

    if (evaluation.approved && evaluation.confidence >= 60) {
      // Override rule amount with AI-suggested amount
      rule.action.amount = evaluation.amount;
      rule.action.memo = `AI: ${evaluation.reasoning.slice(0, 50)}`;

      if (evaluation.confidence < 80) {
        // Low confidence — force MANUAL approval
        logger.info(`⚠️ Low confidence (${evaluation.confidence}%) — escalating to manual approval`);
      }

      try {
        await this.executePayment(rule, evaluation);
        return { ...evaluation };
      } catch (e) {
        logger.error(`AI payment failed: ${e}`);
        return { ...evaluation, paymentTx: undefined };
      }
    }

    return evaluation;
  }

  // --- Persistence ---
  private loadRules() {
    const path = this.config.agentRulesPath || "./config/rules.json";
    try {
      if (existsSync(path)) {
        const data = readFileSync(path, "utf-8");
        const parsed = JSON.parse(data);
        this.rules = Array.isArray(parsed) ? parsed : parsed.rules || [];
        logger.info(`Loaded ${this.rules.length} rules`);
      } else {
        this.rules = this.defaultRules();
      }
    } catch {
      this.rules = this.defaultRules();
    }
  }

  private saveRules() {
    const path = this.config.agentRulesPath || "./config/rules.json";
    try {
      writeFileSync(path, JSON.stringify(this.rules, null, 2));
    } catch (e) {
      logger.error("Failed to save rules:", e);
    }
  }

  private loadPayments() {
    const path = "./config/payments.json";
    try {
      if (existsSync(path)) {
        const data = readFileSync(path, "utf-8");
        this.payments = JSON.parse(data);
        this.paymentCount = this.payments.length;
        logger.info(`Loaded ${this.payments.length} payment records`);
      }
    } catch { /* fresh start */ }
  }

  private savePayments() {
    const path = "./config/payments.json";
    try {
      writeFileSync(path, JSON.stringify(this.payments, null, 2));
    } catch (e) {
      logger.error("Failed to save payments:", e);
    }
  }

  private defaultRules(): AgentRule[] {
    return [
      {
        id: "bug-bounty-1",
        name: "Auto Bug Bounty",
        signal: { source: "github", trigger: "pull_request.merged", conditions: { label: "fix" } },
        action: { type: "pay", recipient: "0x0000000000000000000000000000000000000001", amount: 50, currency: "USDC", memo: "Bug bounty payment" },
        enabled: false, cooldown: 3600,
      },
      {
        id: "flight-refund-1",
        name: "Flight Delay Refund",
        signal: { source: "api", trigger: "flight.delayed", conditions: { delay_hours: 2 } },
        action: { type: "refund", recipient: "0x0000000000000000000000000000000000000001", amount: 100, currency: "USDC", memo: "Flight delay compensation" },
        enabled: false, cooldown: 86400,
      },
      {
        id: "content-tip-1",
        name: "Content Creator Tip",
        signal: { source: "webhook", trigger: "views.milestone", conditions: { views: 1000 } },
        action: { type: "tip", recipient: "0x0000000000000000000000000000000000000001", amount: 5, currency: "USDC", memo: "Content milestone tip" },
        enabled: false, cooldown: 3600,
      },
    ];
  }

  async start() {
    logger.info("🚀 ArcGent starting...");
    this.startTime = new Date();

    this.loadRules();
    this.loadPayments();

    // Initialize wallet
    this.circleWallet = new CircleWallet(this.config);
    await this.circleWallet.initialize();
    logger.info("✅ Circle Wallet connected");

    const balance = await this.circleWallet.getBalance();
    logger.info(`💰 Wallet balance: ${balance} USDC`);

    // Start GitHub listener (real API)
    const ghToken = process.env.GITHUB_TOKEN || "";
    const ghRepos = (process.env.GITHUB_REPOS || "ddettaa/ArcHackathon").split(",").map(r => r.trim());
    this.githubListener = new GitHubListener(ghToken, ghRepos, 30000);
    await this.githubListener.start();

    // GitHub signal handler
    this.githubListener.on("signal", (signal: GitHubSignal) => {
      this.signalCheckCount++;
      this.evaluateGitHubSignal(signal);
    });

    // Initialize real signal sources
    const signalMgr = getSignalManager();
    if (ghToken) {
      const realGH = signalMgr.initGitHub(ghToken, ghRepos, 30000);
      realGH.on("signal", (signal: any) => {
        this.signalCheckCount++;
        this.evaluateRealSignal(signal);
      });
      await realGH.start();
    }
    if (process.env.AVIATIONSTACK_API_KEY) {
      signalMgr.initFlight(process.env.AVIATIONSTACK_API_KEY);
    }
    if (process.env.OPENWEATHER_API_KEY) {
      signalMgr.initWeather(process.env.OPENWEATHER_API_KEY);
    }

    // Start API signal checker
    this.apiSignal = new APISignal();

    // Start evaluation loop
    this.running = true;
    this.evaluationLoop();

    logger.info("🤖 ArcGent is running. Monitoring signals...");
  }

  private async evaluateGitHubSignal(signal: GitHubSignal) {
    if (this.killed) return;

    const matchingRules = this.rules.filter(r =>
      r.enabled &&
      r.signal.source === "github" &&
      r.signal.trigger === signal.type
    );

    for (const rule of matchingRules) {
      if (this.isOnCooldown(rule)) continue;

      const evaluation = this.ruleEngine.evaluateRule(rule, signal);
      if (evaluation.approved) {
        logger.info(`🎯 Signal matched: ${rule.name}`);
        await this.executePayment(rule);
        this.lastTrigger.set(rule.id, Date.now());
      }
    }
  }

  private async evaluateRealSignal(signal: any) {
    if (this.killed) return;

    const matchingRules = this.rules.filter(r =>
      r.enabled &&
      r.signal.source === signal.source &&
      r.signal.trigger === signal.type
    );

    for (const rule of matchingRules) {
      if (this.isOnCooldown(rule)) continue;

      const evaluation = this.ruleEngine.evaluateRule(rule, signal.data);
      if (evaluation.approved) {
        logger.info(`🎯 Real signal matched: ${rule.name}`);
        await this.executePayment(rule);
        this.lastTrigger.set(rule.id, Date.now());
      }
    }
  }

  private async evaluationLoop() {
    const INTERVAL = 10000;

    while (this.running && !this.killed) {
      this.signalCheckCount++;

      const apiRules = this.rules.filter(r => r.enabled && r.signal.source === "api");
      for (const rule of apiRules) {
        if (this.isOnCooldown(rule)) continue;

        try {
          const result = await this.apiSignal.check(rule.signal.trigger, rule.signal.conditions);
          if (result) {
            const evaluation = this.ruleEngine.evaluateRule(rule, result);
            if (evaluation.approved) {
              logger.info(`🎯 API signal matched: ${rule.name}`);
              await this.executePayment(rule);
              this.lastTrigger.set(rule.id, Date.now());
            }
          }
        } catch (e) {
          logger.error(`API check failed for ${rule.id}:`, e);
        }
      }

      await new Promise(r => setTimeout(r, INTERVAL));
    }
  }

  private isOnCooldown(rule: AgentRule): boolean {
    const last = this.lastTrigger.get(rule.id);
    if (!last || !rule.cooldown) return false;
    return (Date.now() - last) < rule.cooldown * 1000;
  }

  private async executePayment(rule: AgentRule, aiEval?: AIEvaluation) {
    if (this.killed) {
      logger.info(`🔴 Payment blocked (kill switch): ${rule.name}`);
      return;
    }

    const approval = getApprovalEngine();
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const record: PaymentRecord = {
      id: paymentId,
      ruleId: rule.id,
      to: rule.action.recipient,
      amount: rule.action.amount,
      status: "pending",
      timestamp: new Date().toISOString(),
      approvalTier: aiEval ? (aiEval.confidence >= 80 ? "AUTO" : "MANUAL") : undefined,
    };
    this.payments.push(record);

    // If AI evaluation with low confidence → force MANUAL tier
    const effectiveAmount = aiEval?.amount || rule.action.amount;
    const tierOverride = aiEval && aiEval.confidence < 80 ? "MANUAL" as const : undefined;

    const doExecute = async (req: ApprovalRequest) => {
      try {
        logger.info(`⚡ Executing: ${rule.action.type} ${effectiveAmount} USDC → ${rule.action.recipient}`);
        const txHash = await this.circleWallet.sendUSDC(
          rule.action.recipient,
          rule.action.amount,
          rule.action.memo
        );
        record.status = "confirmed";
        record.txHash = txHash;
        record.approvalTier = req.tier;
        record.approvalId = req.id;
        this.paymentCount++;
        this.savePayments();
        logger.success(`✅ Payment confirmed! TX: ${txHash}`);
        logger.info(`🔗 https://testnet.arcscan.app/tx/${txHash}`);
        return { txHash };
      } catch (e) {
        record.status = "failed";
        this.savePayments();
        logger.error(`❌ Payment failed:`, e);
        return { error: String(e) };
      }
    };

    const request = approval.createRequest(
      rule.id,
      rule.action.amount,
      rule.action.recipient,
      rule.action.memo || rule.name,
      doExecute
    );

    record.approvalTier = request.tier;
    record.approvalId = request.id;

    if (request.tier === "REVIEW") {
      record.status = "review";
    } else if (request.tier === "MANUAL") {
      record.status = "manual";
    }

    this.savePayments();
  }

  stop() {
    this.running = false;
    this.githubListener?.stop();
    logger.info("🛑 ArcGent stopped");
  }
}

// Singleton
let _agent: ArcGentAgent | null = null;
export function getAgent(): ArcGentAgent {
  if (!_agent) _agent = new ArcGentAgent();
  return _agent;
}
