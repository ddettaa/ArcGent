// ArcGent Database Migration + Seed
// Run once: `bun run src/db/migrate.ts`
// Creates tables and seeds initial data from JSON files

import { getDb, resetDb, schema } from "./index";
import { readFileSync, existsSync } from "fs";

const { rules: rulesTable, payments: paymentsTable, agents: agentsTable, services: servicesTable, approvals: approvalsTable, signals: signalsTable, aiEvaluations: aiEvalsTable, apiKeys: apiKeysTable } = schema;

async function migrate() {
  console.log("🗄️  ArcGent DB Migration...");
  
  const db = getDb();
  const sqlite = (db as any).$client as import("bun:sqlite").Database;
  
  // Create tables
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      signal_source TEXT NOT NULL,
      signal_trigger TEXT NOT NULL,
      signal_conditions TEXT DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_recipient TEXT NOT NULL,
      action_amount REAL NOT NULL,
      action_currency TEXT DEFAULT 'USDC',
      action_memo TEXT,
      enabled INTEGER DEFAULT 1,
      cooldown INTEGER,
      created_by TEXT,
      template_id TEXT,
      config TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      rule_id TEXT REFERENCES rules(id) ON DELETE SET NULL,
      from_agent TEXT,
      to_agent TEXT,
      "to" TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      type TEXT DEFAULT 'payment',
      memo TEXT,
      tx_hash TEXT,
      block_number INTEGER,
      approval_tier TEXT,
      approval_id TEXT,
      ai_evaluation TEXT,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      confirmed_at INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      rule_id TEXT REFERENCES rules(id),
      payment_id TEXT REFERENCES payments(id),
      tier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      status TEXT DEFAULT 'online',
      reputation INTEGER DEFAULT 80,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      response_time TEXT,
      config TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      provider_agent_id TEXT REFERENCES agents(id),
      price_per_unit REAL NOT NULL,
      unit_type TEXT NOT NULL,
      category TEXT DEFAULT 'utility',
      rating REAL DEFAULT 4.5,
      reviews INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      trigger TEXT NOT NULL,
      raw_data TEXT,
      processed INTEGER DEFAULT 0,
      rule_id TEXT REFERENCES rules(id),
      payment_id TEXT REFERENCES payments(id),
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS ai_evaluations (
      id TEXT PRIMARY KEY,
      rule_id TEXT REFERENCES rules(id),
      signal_id TEXT REFERENCES signals(id),
      type TEXT NOT NULL,
      context TEXT,
      approved INTEGER,
      amount REAL,
      confidence INTEGER,
      severity TEXT,
      reasoning TEXT,
      tokens_used INTEGER,
      response_time INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      name TEXT,
      active INTEGER DEFAULT 1,
      last_used INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
  `);
  
  console.log("✅ Tables created");

  // Seed from JSON files
  const rulesPath = "./config/rules.json";
  if (existsSync(rulesPath)) {
    const existingRules = JSON.parse(readFileSync(rulesPath, "utf-8"));
    for (const rule of existingRules) {
      await db.insert(rulesTable).values({
        id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: rule.name || "Unnamed",
        signalSource: rule.signal?.source || rule.signalSource || "github",
        signalTrigger: rule.signal?.trigger || rule.signalTrigger || "",
        signalConditions: rule.signal?.conditions || rule.signalConditions || {},
        actionType: rule.action?.type || rule.actionType || "pay",
        actionRecipient: rule.action?.recipient || rule.actionRecipient || "",
        actionAmount: rule.action?.amount || rule.actionAmount || 0,
        enabled: rule.enabled !== false,
        cooldown: rule.cooldown || null,
      }).onConflictDoNothing().execute();
    }
    console.log(`📋 Seeded ${existingRules.length} rules`);
  }

  const paymentsPath = "./config/payments.json";
  if (existsSync(paymentsPath)) {
    const existingPayments = JSON.parse(readFileSync(paymentsPath, "utf-8"));
    for (const p of existingPayments) {
      await db.insert(paymentsTable).values({
        id: p.id || `pay_${Date.now()}`,
        ruleId: p.ruleId || null,
        to: p.to || "0x",
        amount: p.amount || 0,
        status: p.status || "confirmed",
        txHash: p.txHash || null,
        createdAt: p.timestamp ? new Date(p.timestamp) : new Date(),
      }).onConflictDoNothing().execute();
    }
    console.log(`💰 Seeded ${existingPayments.length} payments`);
  }

  // Seed agents
  const agentData = [
    { id: "content-evaluator", name: "Content Evaluator Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 95, totalEarned: 12400, completedTasks: 312, responseTime: "8s" },
    { id: "translation-agent", name: "Translation Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 88, totalEarned: 8900, completedTasks: 245, responseTime: "12s" },
    { id: "security-auditor", name: "Security Auditor Agent", walletAddress: "0x3695F3261cc7FB2e54106df524c12ce9FFd9a556", reputation: 92, totalEarned: 15100, completedTasks: 187, responseTime: "5s" },
  ];
  for (const a of agentData) {
    await db.insert(agentsTable).values(a).onConflictDoNothing().execute();
  }
  console.log(`🤖 Seeded ${agentData.length} agents`);

  // Seed services
  const serviceData = [
    { id: "content-quality-check", name: "Content Quality Check", description: "AI evaluates content quality and originality", providerAgentId: "content-evaluator", pricePerUnit: 500, unitType: "request", category: "content", rating: 4.8, reviews: 156 },
    { id: "text-translation", name: "Text Translation", description: "Translate between 50+ languages", providerAgentId: "translation-agent", pricePerUnit: 100, unitType: "token", category: "content", rating: 4.5, reviews: 89 },
    { id: "security-scan", name: "Smart Contract Security Scan", description: "Automated vulnerability detection for Solidity contracts", providerAgentId: "security-auditor", pricePerUnit: 1500, unitType: "request", category: "security", rating: 4.9, reviews: 203 },
    { id: "contract-audit", name: "Full Contract Audit", description: "Manual + AI deep dive audit with report", providerAgentId: "security-auditor", pricePerUnit: 3000, unitType: "request", category: "security", rating: 4.7, reviews: 124 },
  ];
  for (const s of serviceData) {
    await db.insert(servicesTable).values(s).onConflictDoNothing().execute();
  }
  console.log(`🔧 Seeded ${serviceData.length} services`);

  // Seed admin API key
  const adminKey = process.env.ARC_ADMIN_KEY || "ag_dccd6ba82f242f3957dff7320e965c085c2e0bf166a170b4";
  await db.insert(apiKeysTable).values({
    id: "admin-key",
    key: adminKey,
    role: "admin",
    name: "Default Admin",
    active: true,
  }).onConflictDoNothing().execute();
  console.log("🔐 Seeded admin API key");

  console.log("✅ Migration + Seed complete!");
  resetDb();
}

migrate().catch(console.error);
