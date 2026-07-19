// ArcGent Agent API Server
// Hono-based REST API for dashboard integration
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAgent, type AgentRule } from "./agent.js";

const app = new Hono();
app.use("*", cors());

// --- STATUS ---
app.get("/api/status", async (c) => {
  try {
    const state = getAgent().getState();
    const balance = await getAgent().getBalance() || "0.00";
    return c.json({
      status: state.status,
      wallet: process.env.AGENT_ADDRESS || "0x0000000000000000000000000000000000000000",
      balance: `${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 6 })}`,
      blockNumber: String(state.signalCheckCount),
      signalChecks: state.signalCheckCount,
      paymentsExecuted: state.paymentCount,
      chain: "5042002",
      uptime: `${Math.floor(state.uptime / 60)}m`,
    });
  } catch (e) {
    return c.json({ status: "ERROR", error: String(e) }, 500);
  }
});

// --- RULES ---
app.get("/api/rules", (c) => c.json(getAgent().getRules()));

app.post("/api/rules", async (c) => {
  const body = await c.req.json<AgentRule>();
  const rule = getAgent().addRule(body);
  return c.json(rule, 201);
});

app.patch("/api/rules/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<AgentRule>>();
  const rule = getAgent().updateRule(id, body);
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

app.post("/api/rules/:id/toggle", (c) => {
  const id = c.req.param("id");
  const rule = getAgent().toggleRule(id);
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

// --- PAYMENTS ---
app.get("/api/payments", (c) => c.json(getAgent().getPayments()));

// --- HEALTH ---
app.get("/api/health", (c) => c.json({ ok: true, uptime: getAgent().getState().uptime }));

// --- START ---
const PORT = 3001;

const agent = getAgent();
agent.start().then(() => {
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`🤖 ArcGent API running on port ${PORT}`);
}).catch(console.error);
