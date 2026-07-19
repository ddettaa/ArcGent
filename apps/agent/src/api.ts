// ArcGent Agent API Server
// Hono-based REST API with webhooks, approvals, kill switch
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAgent, type AgentRule } from "./agent.js";
import { getApprovalEngine, type ApprovalRequest } from "./approval/engine.js";

const app = new Hono();
app.use("/*", cors());

// --- HEALTH ---
app.get("/api/health", (c) => {
  const agent = getAgent();
  return c.json({ ok: true, uptime: agent.getState().uptime });
});

// --- STATUS ---
app.get("/api/status", async (c) => {
  const agent = getAgent();
  const balance = await agent.getBalance();
  const state = agent.getState();
  return c.json({ ...state, balance });
});

// --- RULES ---
app.get("/api/rules", (c) => {
  const agent = getAgent();
  return c.json(agent.getRules());
});

app.post("/api/rules", async (c) => {
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
  const agent = getAgent();
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = agent.updateRule(id, body);
  if (!updated) return c.json({ error: "Rule not found" }, 404);
  return c.json(updated);
});

app.post("/api/rules/:id/toggle", (c) => {
  const agent = getAgent();
  const id = c.req.param("id");
  const rule = agent.toggleRule(id);
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

// --- PAYMENTS ---
app.get("/api/payments", (c) => {
  const agent = getAgent();
  return c.json(agent.getPayments());
});

// --- APPROVALS ---
app.get("/api/approvals", (c) => {
  const approval = getApprovalEngine();
  return c.json(approval.getAll());
});

app.get("/api/approvals/pending", (c) => {
  const approval = getApprovalEngine();
  return c.json(approval.getPending());
});

app.post("/api/approvals/:id/approve", (c) => {
  const approval = getApprovalEngine();
  const id = c.req.param("id");
  const req = approval.approve(id);
  if (!req) return c.json({ error: "Request not found or already processed" }, 404);
  return c.json(req);
});

app.post("/api/approvals/:id/reject", (c) => {
  const approval = getApprovalEngine();
  const id = c.req.param("id");
  const req = approval.reject(id);
  if (!req) return c.json({ error: "Request not found or already processed" }, 404);
  return c.json(req);
});

// --- WEBHOOKS ---
app.post("/api/webhook/:source/:trigger", async (c) => {
  const agent = getAgent();
  const source = c.req.param("source");
  const trigger = c.req.param("trigger");
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook(source, trigger, body);
  return c.json(result);
});

// Convenience webhook endpoints
app.post("/api/webhook/github/pr-merged", async (c) => {
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("github", "pr_merged", body);
  return c.json(result);
});

app.post("/api/webhook/github/issue-closed", async (c) => {
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("github", "issue_closed", body);
  return c.json(result);
});

app.post("/api/webhook/flight/delayed", async (c) => {
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("flight", "delayed", body);
  return c.json(result);
});

app.post("/api/webhook/weather/bad", async (c) => {
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("weather", "bad", body);
  return c.json(result);
});

app.post("/api/webhook/views/milestone", async (c) => {
  const agent = getAgent();
  const body = await c.req.json().catch(() => ({}));
  const result = agent.handleWebhook("views", "milestone", body);
  return c.json(result);
});

// --- KILL SWITCH ---
app.post("/api/kill", (c) => {
  const agent = getAgent();
  agent.kill();
  return c.json({ status: "KILLED", message: "All payments stopped" });
});

app.post("/api/revive", (c) => {
  const agent = getAgent();
  agent.revive();
  return c.json({ status: "RUNNING", message: "Agent resumed" });
});

// --- MULTI-WALLET ---
app.get("/api/wallets", (c) => {
  // TODO: List configured wallets
  return c.json({ wallets: [], current: "default" });
});

app.post("/api/wallets/switch", async (c) => {
  // TODO: Switch active wallet
  const body = await c.req.json();
  return c.json({ switched: true, wallet: body.wallet });
});

// --- START SERVER ---
const PORT = 3001;

async function main() {
  const agent = getAgent();
  await agent.start();
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`🤖 ArcGent API running on port ${PORT}`);
}

main().catch(console.error);
