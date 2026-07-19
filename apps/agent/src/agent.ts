// ArcGent Core Agent v2
// "If this, then pay" — autonomous signal-to-payment agent
// Built on Arc Testnet + Circle Agent Stack

import { createConfig, type Config } from "./utils/config.js";
import { RuleEngine } from "./rules/engine.js";
import { CircleWallet } from "./payments/circle.js";
import { GitHubListener, type GitHubSignal } from "./signals/github.js";
import { APISignal } from "./signals/api.js";
import { Logger } from "./utils/logger.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const logger = new Logger("ArcGent");

export interface AgentRule {
  id: string;
  name: string;
  signal: {
    source: "github" | "api" | "webhook" | "oracle";
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

interface PaymentRecord {
  id: string;
  ruleId: string;
  to: string;
  amount: number;
  status: "pending" | "confirmed" | "failed";
  timestamp: string;
  txHash?: string;
}

export class ArcGentAgent {
  private config: Config;
  private rules: AgentRule[] = [];
  private payments: PaymentRecord[] = [];
  private ruleEngine: RuleEngine;
  private circleWallet!: CircleWallet;
  private githubListener!: GitHubListener;
  private apiSignal!: APISignal;
  private running = false;
  private lastTrigger: Map<string, number> = new Map();
  private signalCheckCount = 0;
  private paymentCount = 0;
  private startTime: Date = new Date();

  constructor(config?: Partial<Config>) {
    this.config = createConfig();
    if (config) Object.assign(this.config, config);
    this.ruleEngine = new RuleEngine();
  }

  getState() {
    return {
      status: this.running ? "RUNNING" as const : "STOPPED" as const,
      rules: this.rules,
      payments: this.payments,
      signalCheckCount: this.signalCheckCount,
      paymentCount: this.paymentCount,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
    };
  }

  getRules(): AgentRule[] { return this.rules; }
  getPayments(): PaymentRecord[] { return this.payments; }

  async getBalance(): Promise<string> {
    if (!this.circleWallet) return "0.00";
    try { return await this.circleWallet.getBalance(); } catch { return "0.00"; }
  }

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

  private loadRules() {
    const path = this.config.agentRulesPath || "./config/rules.json";
    try {
      if (existsSync(path)) {
        const data = readFileSync(path, "utf-8");
        const parsed = JSON.parse(data);
        this.rules = Array.isArray(parsed) ? parsed : parsed.rules || [];
        logger.info(`Loaded ${this.rules.length} rules`);
      } else {
        logger.warn("No rules file found, using defaults");
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

  private defaultRules(): AgentRule[] {
    return [
      {
        id: "bug-bounty-1",
        name: "Auto Bug Bounty",
        signal: {
          source: "github",
          trigger: "pull_request.merged",
          conditions: { label: "fix" },
        },
        action: {
          type: "pay", recipient: "0x0000000000000000000000000000000000000001", amount: 50, currency: "USDC",
          memo: "Bug bounty payment",
        },
        enabled: false, cooldown: 3600,
      },
      {
        id: "flight-refund-1",
        name: "Flight Delay Refund",
        signal: {
          source: "api",
          trigger: "flight.delayed",
          conditions: { delay_hours: 2 },
        },
        action: {
          type: "refund", recipient: "0x0000000000000000000000000000000000000001", amount: 100, currency: "USDC",
          memo: "Flight delay compensation",
        },
        enabled: false, cooldown: 86400,
      },
    ];
  }

  async start() {
    logger.info("🚀 ArcGent starting...");
    this.startTime = new Date();

    // Load rules
    this.loadRules();

    // Initialize wallet
    this.circleWallet = new CircleWallet(this.config);
    await this.circleWallet.initialize();
    logger.info("✅ Circle Wallet connected");

    const balance = await this.circleWallet.getBalance();
    logger.info(`💰 Wallet balance: ${balance} USDC`);

    // Start GitHub listener
    const ghToken = process.env.GITHUB_TOKEN || "";
    const ghRepos = (process.env.GITHUB_REPOS || "ddettaa/ArcHackathon").split(",").map(r => r.trim());
    this.githubListener = new GitHubListener(ghToken, ghRepos, 30000);
    await this.githubListener.start();

    // GitHub signal handler
    this.githubListener.on("signal", (signal: GitHubSignal) => {
      this.signalCheckCount++;
      this.evaluateGitHubSignal(signal);
    });

    // Start API signal checker
    this.apiSignal = new APISignal();

    // Start evaluation loop for API-based rules
    this.running = true;
    this.evaluationLoop();

    logger.info("🤖 ArcGent is running. Monitoring signals...");
  }

  private async evaluateGitHubSignal(signal: GitHubSignal) {
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

  private async evaluationLoop() {
    const INTERVAL = 10000; // 10 seconds

    while (this.running) {
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

  private async executePayment(rule: AgentRule) {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: PaymentRecord = {
      id: paymentId,
      ruleId: rule.id,
      to: rule.action.recipient,
      amount: rule.action.amount,
      status: "pending",
      timestamp: new Date().toISOString(),
    };
    this.payments.push(record);

    try {
      logger.info(`⚡ Executing: ${rule.action.type} ${rule.action.amount} USDC → ${rule.action.recipient}`);
      const txHash = await this.circleWallet.sendUSDC(
        rule.action.recipient,
        rule.action.amount,
        rule.action.memo
      );
      record.status = "confirmed";
      record.txHash = txHash;
      this.paymentCount++;
      logger.success(`✅ Payment confirmed! TX: ${txHash}`);
      logger.info(`🔗 https://testnet.arcscan.app/tx/${txHash}`);
    } catch (e) {
      record.status = "failed";
      logger.error(`❌ Payment failed:`, e);
    }
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
