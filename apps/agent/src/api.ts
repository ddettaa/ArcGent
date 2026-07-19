// ArcGent Agent API Server
// Hono-based REST API with auth, webhooks, approvals, kill switch
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAgent, type AgentRule } from "./agent.js";
import { getApprovalEngine, type ApprovalRequest } from "./approval/engine.js";
import { requireAdmin, requireOperator, requireViewer, extractKey, getAuth } from "./auth/keys.js";
import type { SignalContext } from "./ai/evaluator.js";
import { getEvaluator } from "./ai/evaluator.js";

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
  const agent = getAgent();
  await agent.start();
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`🤖 ArcGent API running on port ${PORT}`);
  console.log(`🔐 Admin key: ${getAuth().getAdminKey()}`);
}

main().catch(console.error);
