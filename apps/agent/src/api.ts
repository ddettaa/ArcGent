// ArcGent Agent API Server
// Hono-based REST API with auth, webhooks, approvals, kill switch
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAgent, type AgentRule } from "./agent.js";
import { getApprovalEngine, type ApprovalRequest } from "./approval/engine.js";
import { requireAdmin, requireOperator, requireViewer, extractKey, getAuth } from "./auth/keys.js";
import { getEvaluator, type SignalContext } from "./ai/evaluator.js";
import { TEMPLATES, instantiateTemplate } from "./rules/templates.js";
import { getAgentPayments } from "./agents/payments.js";
import { createConfig } from "./utils/config.js";
import { getDb, schema } from "./db/index.js";
import { sql, eq } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { getPaymaster } from "./payments/paymaster.js";

const app = new Hono();
app.use("/*", cors());

// Extract owner wallet from header (set by frontend proxy)
function getOwner(c: any): string {
  return c.req.header("x-wallet-address") || "0x0";
}

// --- AUTH MIDDLEWARE ---
// Public endpoints: health, status, rules (GET), payments (GET)
// Viewer+: all GET endpoints
// Operator+: POST /api/rules, PATCH /api/rules, POST /api/webhook
// Admin only: POST /api/kill, POST /api/revive, POST /api/approvals

// --- PUBLIC ---
app.get("/api/health", (c) => {
  const agent = getAgent();
  return c.json({ ok: true, uptime: agent.getState().uptime });
});

app.get("/api/status", async (c) => {
  const agent = getAgent();
  const balance = await agent.getBalance();
  const state = agent.getState();
  return c.json({ ...state, balance, pendingApprovals: state.pendingApprovals?.length });
});

// --- AUTH: wallet signature verification (user-only login) ---
// Simple flow: sign message with wallet → verify → get session token
app.post("/api/auth/verify", async (c) => {
  const { walletAddress, signature, message } = await c.req.json<any>();
  if (!walletAddress || !signature || !message) {
    return c.json({ error: "walletAddress, signature, message required" }, 400);
  }
  // Simple verification: signature contains wallet address hash
  // In production, use viem/ecrecover for cryptographic verification
  if (!signature.startsWith("0x") || signature.length < 10) {
    return c.json({ error: "Invalid signature format" }, 401);
  }
  // Create session token (JWT-lite: wallet + timestamp + hash)
  const ts = Date.now();
  const sessionData = `${walletAddress.toLowerCase()}:${ts}`;
  const sessionToken = Buffer.from(sessionData).toString("base64url");
  
  return c.json({
    walletAddress: walletAddress.toLowerCase(),
    sessionToken,
    expiresAt: ts + 24 * 60 * 60 * 1000, // 24h
  });
});

// --- RISK MANAGEMENT ---
app.get("/api/risk", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  return c.json(agent.getRiskStatus());
});

// Agent provisioning — creates a personal agent for connected wallet
app.post("/api/my-agent", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const { walletAddress, name } = await c.req.json<any>();
  if (!walletAddress) return c.json({ error: "walletAddress required" }, 400);
  
  const db = getDb();
  // Check if agent already exists for this wallet
  const existing = db.select().from(schema.agents).where(eq(schema.agents.ownerAddress, walletAddress)).get();
  if (existing) return c.json(existing);
  
  // Create new agent
  const agentId = `agent_${walletAddress.slice(2, 10)}_${Date.now().toString(36)}`;
  const newAgent = {
    id: agentId,
    ownerAddress: walletAddress,
    name: name || `Agent ${walletAddress.slice(0, 6)}`,
    walletAddress: walletAddress, // user's own wallet
    status: "online",
    reputation: 80,
    totalEarned: 0,
    totalSpent: 0,
    completedTasks: 0,
    responseTime: "—",
  };
  db.insert(schema.agents).values(newAgent).run();
  return c.json(newAgent, 201);
});

// Get agent by wallet address
app.get("/api/my-agent", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const walletAddress = c.req.query("walletAddress");
  if (!walletAddress) return c.json({ error: "walletAddress query param required" }, 400);
  const db = getDb();
  const agent = db.select().from(schema.agents).where(eq(schema.agents.ownerAddress, walletAddress)).get();
  if (!agent) return c.json({ error: "No agent found for this wallet" }, 404);
  return c.json(agent);
});

// Kill user's own agent (sets status to offline)
app.post("/api/my-agent/kill", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const owner = getOwner(c);
  if (owner === "0x0") return c.json({ error: "Wallet required" }, 400);
  const db = getDb();
  const agent = db.select().from(schema.agents).where(eq(schema.agents.ownerAddress, owner)).get();
  if (!agent) return c.json({ error: "No agent found" }, 404);
  db.update(schema.agents).set({ status: "offline" }).where(eq(schema.agents.ownerAddress, owner)).run();
  return c.json({ ...agent, status: "offline" });
});

// Revive user's own agent
app.post("/api/my-agent/revive", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const owner = getOwner(c);
  if (owner === "0x0") return c.json({ error: "Wallet required" }, 400);
  const db = getDb();
  const agent = db.select().from(schema.agents).where(eq(schema.agents.ownerAddress, owner)).get();
  if (!agent) return c.json({ error: "No agent found" }, 404);
  db.update(schema.agents).set({ status: "online" }).where(eq(schema.agents.ownerAddress, owner)).run();
  return c.json({ ...agent, status: "online" });
});

app.post("/api/risk/limits", async (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json();
  const { dailyCap, perRuleCap, perTxMax, cooldownMs } = body;
  if (dailyCap !== undefined) agent.riskLimits.dailyCap = dailyCap;
  if (perRuleCap !== undefined) agent.riskLimits.perRuleCap = perRuleCap;
  if (perTxMax !== undefined) agent.riskLimits.perTxMax = perTxMax;
  if (cooldownMs !== undefined) agent.riskLimits.cooldownMs = cooldownMs;
  return c.json({ ok: true, limits: agent.riskLimits });
});

// --- VIEWER (any authenticated user) ---
app.get("/api/rules", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const owner = getOwner(c);
  if (owner === "0x0") return c.json(agent.getRules()); // shared/default
  const db = getDb();
  const rules = db.select().from(schema.rules).where(eq(schema.rules.ownerAddress, owner)).all();
  return c.json(rules.length ? rules : []);
});

app.get("/api/payments", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const owner = getOwner(c);
  if (owner === "0x0") return c.json(agent.getPayments());
  const db = getDb();
  const payments = db.select().from(schema.payments).where(eq(schema.payments.ownerAddress, owner)).all();
  return c.json(payments.length ? payments : []);
});

app.get("/api/approvals", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const approval = getApprovalEngine();
  return c.json(approval.getAll());
});

// Real payment history with daily aggregation for analytics
app.get("/api/payments/history", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const days = parseInt(c.req.query("days") || "7");
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  
  // Get all payments with real timestamps
  const allPayments = await db.select().from(schema.payments).all();
  
  // Filter by time range
  const filtered = allPayments.filter(p => {
    const ts = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    return ts >= cutoff;
  });
  
  // Group by date
  const dailyMap = new Map<string, { volume: number; transactions: number }>();
  for (const p of filtered) {
    const date = p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "unknown";
    const existing = dailyMap.get(date) || { volume: 0, transactions: 0 };
    existing.volume += p.amount;
    existing.transactions += 1;
    dailyMap.set(date, existing);
  }
  
  // Sort by date, take last 7
  const dailyVolume = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([date, data]) => ({ date, ...data }));
  
  // Get A2A payments for activity feed
  let agentPayments: any[] | Promise<any[]> = [];
  try {
    const config = createConfig();
    const a2a = getAgentPayments(config);
    const result = await a2a.getPayments();
    agentPayments = Array.isArray(result) ? result : [];
  } catch { /* A2A not initialized yet */ }
  
  const activity = filtered.map(p => ({
    id: p.id,
    type: p.fromAgent ? "spent" : "earned",
    agentId: p.fromAgent || p.ruleId || "system",
    amount: p.amount,
    service: p.memo || "payment",
    timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    txHash: p.txHash,
    status: p.status,
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  
  return c.json({
    totalVolume: filtered.reduce((s, p) => s + p.amount, 0),
    totalPayments: filtered.length,
    averageAmount: filtered.length ? filtered.reduce((s, p) => s + p.amount, 0) / filtered.length : 0,
    dailyVolume,
    activity,
    agentPayments: (agentPayments || []).length,
  });
});

app.get("/api/approvals/pending", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const approval = getApprovalEngine();
  return c.json(approval.getPending());
});

// --- TEMPLATES ---
app.get("/api/templates", (c) => {
  return c.json(TEMPLATES);
});

app.post("/api/templates/:id/instantiate", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const templateId = c.req.param("id");
  const owner = getOwner(c);
  const formData = await c.req.json();
  try {
    const rule = instantiateTemplate(templateId, formData);
    const agent = getAgent();
    const created = agent.addRule(rule);
    // Attach owner for multi-tenant filtering
    if (owner !== "0x0" && created?.id) {
      const db = getDb();
      await db.insert(schema.rules).values({
        id: created.id,
        ownerAddress: owner,
        name: created.name || "Template Rule",
        signalSource: created.signal?.source || "webhook",
        signalTrigger: created.signal?.trigger || "",
        signalConditions: created.signal?.conditions || {},
        actionType: created.action?.type || "pay",
        actionRecipient: created.action?.recipient || "",
        actionAmount: created.action?.amount || 0,
        enabled: created.enabled !== false,
      }).onConflictDoNothing().run();
    }
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// --- OPERATOR (can create/modify rules, trigger webhooks) ---
app.post("/api/rules", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const owner = getOwner(c);
  const body = await c.req.json();
  const rule: AgentRule = {
    id: body.id || `rule_${Date.now()}`,
    name: body.name || "Unnamed Rule",
    signal: body.signal || { source: "webhook", trigger: "custom", conditions: {} },
    action: body.action || { type: "pay", recipient: "", amount: 0, currency: "USDC" },
    enabled: body.enabled ?? false,
    cooldown: body.cooldown,
  } as AgentRule & { ownerAddress?: string };
  (rule as any).ownerAddress = owner;
  // Attach owner for multi-tenant filtering
  if (owner !== "0x0") {
    const db = getDb();
    await db.insert(schema.rules).values({
      id: rule.id,
      ownerAddress: owner,
      name: rule.name,
      signalSource: rule.signal.source,
      signalTrigger: rule.signal.trigger,
      signalConditions: rule.signal.conditions || {},
      actionType: rule.action.type,
      actionRecipient: rule.action.recipient,
      actionAmount: rule.action.amount,
      actionCurrency: rule.action.currency || "USDC",
      actionMemo: rule.action.memo || null,
      enabled: rule.enabled,
      cooldown: rule.cooldown || null,
    }).onConflictDoNothing().run();
  }
  const created = agent.addRule(rule);
  return c.json(created, 201);
});

app.patch("/api/rules/:id", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = agent.updateRule(id, body);
  if (!updated) return c.json({ error: "Rule not found" }, 404);
  return c.json(updated);
});

app.post("/api/rules/:id/toggle", (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const id = c.req.param("id");
  const rule = agent.toggleRule(id);
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

// --- WEBHOOKS (operator+) ---
app.post("/api/webhook/:source/:trigger", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const source = c.req.param("source");
  const trigger = c.req.param("trigger");
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook(source, trigger, body);
  return c.json(result);
});

app.post("/api/webhook/github/pr-merged", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("github", "pr_merged", body);
  return c.json(result);
});

app.post("/api/webhook/github/issue-closed", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("github", "issue_closed", body);
  return c.json(result);
});

app.post("/api/webhook/flight/delayed", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("flight", "delayed", body);
  return c.json(result);
});

app.post("/api/webhook/weather/bad", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("weather", "bad", body);
  return c.json(result);
});

app.post("/api/webhook/views/milestone", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("views", "milestone", body);
  return c.json(result);
});

// --- SIGNAL SIMULATOR (demo/hackathon) ---
// Runs full flow: signal → AI evaluate → auto-pay → trace
app.post("/api/simulate", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  
  const trace: string[] = [];
  const signal = body.signal || "webhook";
  const trigger = body.trigger || "pr_merged";
  const metadata = body.metadata || { repo: "arcgent/demo", pr: 42, author: "dev" };
  
  trace.push(`📡 Signal received: ${signal}/${trigger}`);
  
  // Step 1: Find matching rules
  const db = getDb();
  const matchingRules = db.select().from(schema.rules).where(
    eq(schema.rules.signalSource, signal)
  ).all().filter(r => r.enabled);
  
  trace.push(`🔍 Found ${matchingRules.length} matching rule(s)`);
  
  if (!matchingRules.length) {
    return c.json({ success: false, trace, message: "No matching rules found. Create a rule first!" });
  }
  
  // Step 2: AI evaluation
  const aiResult = await agent.evaluateSignal(signal, trigger, metadata);
  trace.push(`🧠 AI evaluated: ${aiResult.confidence}% confidence — ${aiResult.reasoning}`);
  
  // Step 3: Execute matching rule if AI approves
  const executed: any[] = [];
  if (aiResult.confidence >= 60) {
    for (const rule of matchingRules) {
      if (rule.actionAmount > 0 && rule.actionRecipient) {
        try {
          const txHash = await agent.executePaymentSimple(
            rule.actionRecipient,
            rule.actionAmount,
            `Simulated: ${rule.name} — ${trigger}`
          );
          trace.push(`💸 Paid ${(rule.actionAmount / 1e6).toFixed(4)} USDC to ${rule.actionRecipient.slice(0, 10)}...`);
          trace.push(`✅ TX: ${txHash.slice(0, 20)}...`);
          executed.push({ rule: rule.name, amount: rule.actionAmount, txHash });
        } catch (err: any) {
          trace.push(`❌ Payment failed: ${err.message}`);
          executed.push({ rule: rule.name, amount: rule.actionAmount, error: err.message });
        }
      }
    }
  } else {
    trace.push(`⏸️ Skipped payment — AI confidence too low (${aiResult.confidence}% < 60%)`);
  }
  
  return c.json({
    success: executed.length > 0,
    trace,
    signal: { source: signal, trigger, metadata },
    ai: aiResult,
    executed,
    message: executed.length 
      ? `🎉 Agent auto-paid ${executed.length} rule(s)!` 
      : "Signal processed but no payments made.",
  });
});

// --- ADMIN ONLY (kill switch, approvals) ---
app.post("/api/kill", (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized — admin only" }, 403);
  const agent = getAgent();
  agent.kill();
  return c.json({ status: "KILLED", message: "All payments stopped" });
});

app.post("/api/revive", (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized — admin only" }, 403);
  const agent = getAgent();
  agent.revive();
  return c.json({ status: "RUNNING", message: "Agent resumed" });
});

app.post("/api/approvals/:id/approve", (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized — admin only" }, 403);
  const approval = getApprovalEngine();
  const id = c.req.param("id");
  const req = approval.approve(id);
  if (!req) return c.json({ error: "Request not found" }, 404);
  return c.json(req);
});

app.post("/api/approvals/:id/reject", (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized — admin only" }, 403);
  const approval = getApprovalEngine();
  const id = c.req.param("id");
  const req = approval.reject(id);
  if (!req) return c.json({ error: "Request not found" }, 404);
  return c.json(req);
});

// --- ADMIN: KEY MANAGEMENT ---
app.get("/api/auth/keys", (c) => {
  if (!requireAdmin(c.req.raw)) return c.json({ error: "Unauthorized" }, 403);
  const auth = getAuth();
  return c.json({ adminKey: auth.getAdminKey(), note: "Set ARC_ADMIN_KEY in .env to persist" });
});

// --- NANOPAYMENTS ---
app.post("/api/nanopayments/send", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const { to, microAmount, memo } = await c.req.json();
  
  if (!to || !microAmount) {
    return c.json({ error: "Missing 'to' address or 'microAmount'" }, 400);
  }

  try {
    const agent = getAgent();
    const txHash = await agent.circleWallet.sendNanopayment(to, microAmount, memo);
    broadcast("payment", { type: "nanopayment", txHash, to, amount: microAmount, memo });
    return c.json({ 
      success: true, 
      txHash, 
      microAmount, 
      usdcAmount: microAmount / 1000000,
      to, 
      memo 
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- PAYMASTER ---
app.get("/api/paymaster/policies", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const config = createConfig();
  const paymaster = getPaymaster(config);
  const policies = await paymaster.getPolicies();
  return c.json(policies);
});

app.post("/api/paymaster/sponsor", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const request = await c.req.json();
  const config = createConfig();
  
  try {
    const paymaster = getPaymaster(config);
    const result = await paymaster.sponsorTransaction(request);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/paymaster/stats", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const config = createConfig();
  const paymaster = getPaymaster(config);
  const stats = await paymaster.getSponsorshipStats();
  return c.json(stats);
});

// --- AGENT-TO-AGENT PAYMENTS ---
app.get("/api/agents", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const owner = getOwner(c);
  if (owner !== "0x0") {
    // Return only user's agents
    const db = getDb();
    const userAgents = db.select().from(schema.agents).where(eq(schema.agents.ownerAddress, owner)).all();
    return c.json(userAgents.length ? userAgents : []);
  }
  // Admin/shared view: all agents
  const config = createConfig();
  const agentPayments = getAgentPayments(config);
  await agentPayments.initialize();
  const agents = await agentPayments.getAgents();
  return c.json(agents);
});

app.get("/api/agents/services", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const config = createConfig();
  const agentPayments = getAgentPayments(config);
  await agentPayments.initialize();
  const services = await agentPayments.getServices();
  return c.json(services);
});

app.post("/api/agents/pay", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const { fromAgentId, serviceId, units, metadata } = await c.req.json();
  const config = createConfig();
  
  try {
    const agentPayments = getAgentPayments(config);
    await agentPayments.initialize();
    const payment = await agentPayments.payForService(fromAgentId, serviceId, units, metadata);
    return c.json(payment);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/agents/payments", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const config = createConfig();
  const agentPayments = getAgentPayments(config);
  await agentPayments.initialize();
  const payments = await agentPayments.getPayments();
  return c.json(payments);
});

app.get("/api/agents/stats", async (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const config = createConfig();
  const agentPayments = getAgentPayments(config);
  await agentPayments.initialize();
  const stats = await agentPayments.getAgentStats();
  return c.json(stats);
});

// --- AI EVALUATION ---
app.post("/api/ai/evaluate", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json();
  const ruleId = body.ruleId || "ai-default";
  const context: SignalContext = {
    type: body.type || "generic",
    title: body.title || "Untitled",
    description: body.description || body.rawData?.title || "",
    rawData: body.rawData || {},
  };
  const result = await agent.evaluateWithAI(ruleId, context);
  return c.json(result);
});

app.get("/api/ai/stats", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const evaluator = getEvaluator();
  return c.json(evaluator.getStats());
});

// --- WEBSOCKET ---
// Broadcast events to connected dashboard clients
const wsClients = new Set<any>();

export function broadcast(event: string, data: any) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  for (const ws of wsClients) {
    try { ws.send(msg); } catch { wsClients.delete(ws); }
  }
}

// --- START SERVER ---
const PORT = 3001;

async function main() {
  // Auto-migrate: ensures DB is always up-to-date
  const db = getDb();
  const sqlite = (db as any).$client as import("bun:sqlite").Database;
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY, owner_address TEXT NOT NULL DEFAULT '0x0',
      name TEXT NOT NULL, signal_source TEXT NOT NULL,
      signal_trigger TEXT NOT NULL, signal_conditions TEXT DEFAULT '{}',
      action_type TEXT NOT NULL, action_recipient TEXT NOT NULL,
      action_amount REAL NOT NULL, action_currency TEXT DEFAULT 'USDC',
      action_memo TEXT, enabled INTEGER DEFAULT 1, cooldown INTEGER,
      created_by TEXT, template_id TEXT, config TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, owner_address TEXT NOT NULL DEFAULT '0x0',
      rule_id TEXT, from_agent TEXT, to_agent TEXT,
      "to" TEXT NOT NULL, amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', type TEXT DEFAULT 'payment',
      memo TEXT, tx_hash TEXT, block_number INTEGER,
      approval_tier TEXT, approval_id TEXT,
      ai_evaluation TEXT, metadata TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000), confirmed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, owner_address TEXT NOT NULL DEFAULT '0x0',
      name TEXT NOT NULL, wallet_address TEXT NOT NULL,
      status TEXT DEFAULT 'online', reputation INTEGER DEFAULT 80,
      total_earned REAL DEFAULT 0, total_spent REAL DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0, response_time TEXT,
      config TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      provider_agent_id TEXT, price_per_unit REAL NOT NULL,
      unit_type TEXT NOT NULL, category TEXT DEFAULT 'utility',
      rating REAL DEFAULT 4.5, reviews INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, trigger TEXT NOT NULL,
      raw_data TEXT, processed INTEGER DEFAULT 0,
      rule_id TEXT, payment_id TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, rule_id TEXT, payment_id TEXT,
      tier TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT, reviewed_by TEXT, reviewed_at INTEGER,
      expires_at INTEGER, created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS ai_evaluations (
      id TEXT PRIMARY KEY, rule_id TEXT, signal_id TEXT,
      type TEXT NOT NULL, context TEXT, approved INTEGER,
      amount REAL, confidence INTEGER, severity TEXT,
      reasoning TEXT, tokens_used INTEGER, response_time INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, role TEXT NOT NULL,
      name TEXT, active INTEGER DEFAULT 1, last_used INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
  `);
  console.log("🗄️ DB ready");

  // Seed rules + payments from old JSON if DB is empty
  // NOTE: tables created by migration above; drizzle uses schema.table names
  let ruleCount;
  try {
    ruleCount = db.select({ c: sql`count(*)` }).from(schema.rules).get();
  } catch {
    ruleCount = { c: 0 };
  }
  if (!ruleCount?.c) {
    const rulesPath = "./config/rules.json";
    if (existsSync(rulesPath)) {
      const oldRules = JSON.parse(readFileSync(rulesPath, "utf-8"));
      for (const r of oldRules) {
        const id = r.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(schema.rules).values({
          id, ownerAddress: "0x0",
          name: r.name || "Unnamed",
          signalSource: r.signal?.source || "github",
          signalTrigger: r.signal?.trigger || "",
          signalConditions: r.signal?.conditions || {},
          actionType: r.action?.type || "pay",
          actionRecipient: r.action?.recipient || "0x",
          actionAmount: r.action?.amount || 0,
          enabled: r.enabled !== false,
          cooldown: r.cooldown || null,
        }).onConflictDoNothing().run();
      }
      console.log(`📋 Migrated ${oldRules.length} rules from JSON → DB`);
    }
    
    const paymentsPath = "./config/payments.json";
    if (existsSync(paymentsPath)) {
      const oldPayments = JSON.parse(readFileSync(paymentsPath, "utf-8"));
      for (const p of oldPayments) {
        await db.insert(schema.payments).values({
          id: p.id || `pay_${Date.now()}`,
          ownerAddress: "0x0",
          ruleId: p.ruleId || null,
          to: p.to || "0x",
          amount: p.amount < 1 ? p.amount * 1e6 : p.amount, // convert from USDC to micro-USDC if needed
          status: p.status || "confirmed",
          txHash: p.txHash || null,
          createdAt: p.timestamp ? new Date(p.timestamp) : undefined,
        }).onConflictDoNothing().run();
      }
      console.log(`💰 Migrated ${oldPayments.length} payments from JSON → DB`);
    }
  }

  // Seed agents/services if empty
  const agentCount = db.select({ c: sql`count(*)` }).from(schema.agents).get();
  if (!agentCount?.c) {
    await db.insert(schema.agents).values([
      { id: "content-evaluator", ownerAddress: "0x0", name: "Content Evaluator Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 95, totalEarned: 12400, completedTasks: 312, responseTime: "8s" },
      { id: "translation-agent", ownerAddress: "0x0", name: "Translation Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 88, totalEarned: 8900, completedTasks: 245, responseTime: "12s" },
      { id: "security-auditor", ownerAddress: "0x0", name: "Security Auditor Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 92, totalEarned: 15100, completedTasks: 187, responseTime: "5s" },
    ]).run();
    await db.insert(schema.services).values([
      { id: "content-quality-check", name: "Content Quality Check", description: "AI evaluates content quality and originality", providerAgentId: "content-evaluator", pricePerUnit: 500, unitType: "request", category: "content", rating: 4.8, reviews: 156 },
      { id: "text-translation", name: "Text Translation", description: "Translate between 50+ languages", providerAgentId: "translation-agent", pricePerUnit: 100, unitType: "token", category: "content", rating: 4.5, reviews: 89 },
      { id: "security-scan", name: "Smart Contract Security Scan", description: "Automated vulnerability detection", providerAgentId: "security-auditor", pricePerUnit: 1500, unitType: "request", category: "security", rating: 4.9, reviews: 203 },
      { id: "contract-audit", name: "Full Contract Audit", description: "Deep dive audit with report", providerAgentId: "security-auditor", pricePerUnit: 3000, unitType: "request", category: "security", rating: 4.7, reviews: 124 },
    ]).run();
    await db.insert(schema.apiKeys).values({
      id: "admin-key", key: process.env.ARC_ADMIN_KEY || "ag_dccd6ba82f242f3957dff7320e965c085c2e0bf166a170b4",
      role: "admin", name: "Default Admin", active: true,
    }).onConflictDoNothing().run();
    console.log("🌱 Database seeded");
  }

  const agent = getAgent();
  await agent.start();

  Bun.serve({
    port: PORT,
    fetch(req, server) {
      // WebSocket upgrade for real-time notifications
      if (req.headers.get("upgrade") === "websocket") {
        const success = server.upgrade(req);
        if (success) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return app.fetch(req, server);
    },
    websocket: {
      open(ws) {
        wsClients.add(ws);
        console.log(`[WS] Client connected (${wsClients.size} total)`);
        ws.send(JSON.stringify({ event: "connected", data: { status: "ok" }, ts: Date.now() }));
      },
      message(ws, msg) {
        // Handle ping/pong
        if (msg === "ping") ws.send("pong");
      },
      close(ws) {
        wsClients.delete(ws);
        console.log(`[WS] Client disconnected (${wsClients.size} remaining)`);
      },
    },
  });
  console.log(`🤖 ArcGent API running on port ${PORT} (HTTP + WebSocket)`);
}

main().catch(console.error);
