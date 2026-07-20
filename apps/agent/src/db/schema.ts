// ArcGent Database Schema — Drizzle ORM + SQLite (bun:sqlite)
// Single-file SQLite, zero setup, zero server
// Migrate to Turso/PostgreSQL later with 1 config change

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── RULES ────────────────────────────────────────
export const rules = sqliteTable("rules", {
  id: text("id").primaryKey(),
  ownerAddress: text("owner_address").notNull(),    // who owns this rule (user wallet)
  name: text("name").notNull(),
  signalSource: text("signal_source").notNull(),   // github | api | webhook | oracle | ai
  signalTrigger: text("signal_trigger").notNull(),
  signalConditions: text("signal_conditions", { mode: "json" }).$type<Record<string, any>>().default({}),
  actionType: text("action_type").notNull(),       // pay | tip | refund
  actionRecipient: text("action_recipient").notNull(),
  actionAmount: real("action_amount").notNull(),
  actionCurrency: text("action_currency").default("USDC"),
  actionMemo: text("action_memo"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  cooldown: integer("cooldown"),                   // seconds
  createdBy: text("created_by"),                   // admin/operator
  templateId: text("template_id"),                 // which template instantiated this
  config: text("config", { mode: "json" }).$type<Record<string, any>>().default({}),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── PAYMENTS ─────────────────────────────────────
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  ownerAddress: text("owner_address").notNull(),    // who owns this payment
  ruleId: text("rule_id").references(() => rules.id, { onDelete: "set null" }),
  fromAgent: text("from_agent"),                   // agent-to-agent: sender
  toAgent: text("to_agent"),                       // agent-to-agent: receiver
  to: text("to").notNull(),                        // recipient address
  amount: real("amount").notNull(),                // micro-USDC
  status: text("status").notNull().default("pending"), // pending | confirmed | failed | review | manual
  type: text("type").default("payment"),           // payment | nanopayment | tip | refund | a2a
  memo: text("memo"),
  txHash: text("tx_hash"),                         // on-chain TX hash
  blockNumber: integer("block_number"),
  approvalTier: text("approval_tier"),             // auto | review | manual
  approvalId: text("approval_id"),
  aiEvaluation: text("ai_evaluation", { mode: "json" }).$type<Record<string, any>>(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});

// ─── APPROVALS ────────────────────────────────────
export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").references(() => rules.id),
  paymentId: text("payment_id").references(() => payments.id),
  tier: text("tier").notNull(),                    // auto | review | manual
  status: text("status").notNull().default("pending"), // pending | pending_review | pending_manual | approved | rejected
  reason: text("reason"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // timeout for review
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── AGENTS ────────────────────────────────────────
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),                     // unique agent ID
  ownerAddress: text("owner_address").notNull(),    // user wallet that owns this agent
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  status: text("status").default("online"),         // online | busy | offline
  reputation: integer("reputation").default(80),    // 0-100
  totalEarned: real("total_earned").default(0),     // micro-USDC
  totalSpent: real("total_spent").default(0),
  completedTasks: integer("completed_tasks").default(0),
  responseTime: text("response_time"),              // e.g. "12s"
  config: text("config", { mode: "json" }).$type<Record<string, any>>().default({}),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── SERVICES ─────────────────────────────────────
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  providerAgentId: text("provider_agent_id").references(() => agents.id),
  pricePerUnit: real("price_per_unit").notNull(),   // micro-USDC
  unitType: text("unit_type").notNull(),            // request | token | line | minute
  category: text("category").default("utility"),    // content | security | utility
  rating: real("rating").default(4.5),
  reviews: integer("reviews").default(0),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── SIGNALS ──────────────────────────────────────
export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),                 // github | api | webhook | oracle
  trigger: text("trigger").notNull(),
  rawData: text("raw_data", { mode: "json" }).$type<Record<string, any>>(),
  processed: integer("processed", { mode: "boolean" }).default(false),
  ruleId: text("rule_id").references(() => rules.id),
  paymentId: text("payment_id").references(() => payments.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── AI EVALUATIONS ───────────────────────────────
export const aiEvaluations = sqliteTable("ai_evaluations", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").references(() => rules.id),
  signalId: text("signal_id").references(() => signals.id),
  type: text("type").notNull(),                     // bug_bounty | content_quality | dispute | generic
  context: text("context", { mode: "json" }).$type<Record<string, any>>(),
  approved: integer("approved", { mode: "boolean" }),
  amount: real("amount"),
  confidence: integer("confidence"),                 // 0-100
  severity: text("severity"),                        // critical | high | medium | low
  reasoning: text("reasoning"),
  tokensUsed: integer("tokens_used"),
  responseTime: integer("response_time"),            // ms
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── API KEYS ─────────────────────────────────────
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  role: text("role").notNull(),                     // admin | operator | viewer
  name: text("name"),                               // who this key belongs to
  active: integer("active", { mode: "boolean" }).default(true),
  lastUsed: integer("last_used", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── REPUTATION / REVIEWS ──────────────────────────
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),              // which agent is reviewed
  reviewer: text("reviewer").notNull(),             // wallet of reviewer
  rating: integer("rating").notNull(),              // 1-5 stars
  comment: text("comment"),
  txHash: text("tx_hash"),                          // linked payment TX
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
