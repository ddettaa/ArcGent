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

const app = new Hono();
app.use("/*", cors());

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
  // Don't leak sensitive info
  return c.json({ ...state, balance, pendingApprovals: state.pendingApprovals?.length });
});

// --- VIEWER (any authenticated user) ---
app.get("/api/rules", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  return c.json(agent.getRules());
});

app.get("/api/payments", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  return c.json(agent.getPayments());
});

app.get("/api/approvals", (c) => {
  if (!requireViewer(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const approval = getApprovalEngine();
  return c.json(approval.getAll());
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
  const formData = await c.req.json();
  try {
    const rule = instantiateTemplate(templateId, formData);
    const agent = getAgent();
    const created = agent.addRule(rule);
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// --- OPERATOR (can create/modify rules, trigger webhooks) ---
app.post("/api/rules", async (c) => {
  if (!requireOperator(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  const agent = getAgent();
  const body = await c.req.json();
  const rule: AgentRule = {
    id: body.id || `rule_${Date.now()}`,
    name: body.name || "Unnamed Rule",
    signal: body.signal || { source: "webhook", trigger: "custom", conditions: {} },
    action: body.action || { type: "pay", recipient: "", amount: 0, currency: "USDC" },
    enabled: body.enabled ?? false,
    cooldown: body.cooldown,
  };
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

// --- START SERVER ---
const PORT = 3001;

async function main() {
  // Auto-migrate: ensures DB is always up-to-date
  const db = getDb();
  const sqlite = (db as any).$client as import("bun:sqlite").Database;
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, signal_source TEXT NOT NULL,
      signal_trigger TEXT NOT NULL, signal_conditions TEXT DEFAULT '{}',
      action_type TEXT NOT NULL, action_recipient TEXT NOT NULL,
      action_amount REAL NOT NULL, action_currency TEXT DEFAULT 'USDC',
      action_memo TEXT, enabled INTEGER DEFAULT 1, cooldown INTEGER,
      created_by TEXT, template_id TEXT, config TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, rule_id TEXT, from_agent TEXT, to_agent TEXT,
      "to" TEXT NOT NULL, amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', type TEXT DEFAULT 'payment',
      memo TEXT, tx_hash TEXT, block_number INTEGER,
      approval_tier TEXT, approval_id TEXT,
      ai_evaluation TEXT, metadata TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000), confirmed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, wallet_address TEXT NOT NULL,
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

  // Seed agents/services if empty
  const agentCount = db.select({ c: sql`count(*)` }).from(schema.agents).get();
  if (!agentCount?.c) {
    await db.insert(schema.agents).values([
      { id: "content-evaluator", name: "Content Evaluator Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 95, totalEarned: 12400, completedTasks: 312, responseTime: "8s" },
      { id: "translation-agent", name: "Translation Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 88, totalEarned: 8900, completedTasks: 245, responseTime: "12s" },
      { id: "security-auditor", name: "Security Auditor Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 92, totalEarned: 15100, completedTasks: 187, responseTime: "5s" },
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
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`🤖 ArcGent API running on port ${PORT}`);
}

main().catch(console.error);
