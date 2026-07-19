"use client";

import { useState } from "react";

// Types
interface Rule {
  id: string;
  name: string;
  description?: string;
  signal: {
    source: string;
    trigger: string;
    conditions: Record<string, any>;
  };
  action: {
    type: string;
    recipient: string;
    amount: number;
    currency: string;
    memo?: string;
  };
  enabled: boolean;
  cooldown?: number;
}

interface Payment {
  id: string;
  txHash: string;
  rule: string;
  recipient: string;
  amount: number;
  status: "pending" | "confirmed" | "failed";
  timestamp: string;
}

interface AgentStatus {
  running: boolean;
  rulesCount: number;
  balance: string;
  walletAddress: string;
  lastSignalCheck: string;
}

export default function Dashboard() {
  const defaultRules: Rule[] = [
    {
      id: "bug-bounty-1",
      name: "Auto Bug Bounty",
      description: "Pay when PR with 'fix' label is merged",
      signal: { source: "github", trigger: "pull_request.merged", conditions: { label: "fix" } },
      action: { type: "pay", recipient: "0x1234...5678", amount: 50, currency: "USDC" },
      enabled: false,
      cooldown: 3600,
    },
    {
      id: "flight-delay-1",
      name: "Flight Delay Refund",
      description: "Refund when flight delayed > 2 hours",
      signal: { source: "api", trigger: "flight.delayed", conditions: { delay_hours: 2 } },
      action: { type: "refund", recipient: "0xabcd...ef12", amount: 100, currency: "USDC" },
      enabled: false,
      cooldown: 86400,
    },
    {
      id: "tip-stream-1",
      name: "Content Tip Stream",
      description: "Tip writer when content hits 1000 reads",
      signal: { source: "api", trigger: "page.views", conditions: { threshold: 1000 } },
      action: { type: "tip", recipient: "0x9876...5432", amount: 5, currency: "USDC" },
      enabled: false,
      cooldown: 604800,
    },
  ];

  const defaultStatus: AgentStatus = {
    running: true,
    rulesCount: 4,
    balance: "865,034,306.42",
    walletAddress: "0x742d...a3f8",
    lastSignalCheck: "2 min ago",
  };

  const [rules, setRules] = useState<Rule[]>(defaultRules);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status] = useState<AgentStatus>(defaultStatus);
  const [activeTab, setActiveTab] = useState<"overview" | "rules" | "payments">("overview");
  const [showNewRule, setShowNewRule] = useState(false);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const signalSourceColors: Record<string, string> = {
    github: "bg-ocean text-sand",
    api: "bg-coral text-sand",
    oracle: "bg-purple text-sand",
    onchain: "bg-mint text-sand",
    webhook: "bg-gold text-sand",
  };

  const actionTypeColors: Record<string, string> = {
    pay: "bg-ocean text-sand",
    tip: "bg-mint text-sand",
    refund: "bg-coral text-sand",
    escrow: "bg-purple text-sand",
  };

  return (
    <div className="min-h-screen bg-sand">
      {/* Header */}
      <header className="bg-ink text-sand px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-ocean rounded-lg grid place-items-center font-black text-sm">AG</div>
          <div>
            <h1 className="font-bold text-lg">ArcGent</h1>
            <p className="text-xs opacity-60">Signal-to-Payment Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${status.running ? "bg-mint/20 text-mint" : "bg-coral/20 text-coral"}`}>
            <span className={`w-2 h-2 rounded-full ${status.running ? "bg-mint animate-pulse" : "bg-coral"}`} />
            {status.running ? "RUNNING" : "STOPPED"}
          </div>
          <div className="text-right">
            <p className="text-xs opacity-60">Balance</p>
            <p className="font-bold text-sm">{status.balance} USDC</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-1">
        {(["overview", "rules", "payments"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white text-ink shadow-sm"
                : "text-steel hover:text-ink"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <main className="px-6 pb-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-xs text-steel mb-1">Active Rules</p>
                <p className="text-3xl font-black text-ink">{status.rulesCount}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-xs text-steel mb-1">Wallet Balance</p>
                <p className="text-3xl font-black text-mint">{status.balance.split(".")[0]} USDC</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-xs text-steel mb-1">Last Signal Check</p>
                <p className="text-3xl font-black text-steel">{status.lastSignalCheck}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-xs text-steel mb-1">Network</p>
                <p className="text-lg font-bold text-ocean">Arc Testnet</p>
                <p className="text-xs text-steel">Chain ID: 5042002</p>
              </div>
            </div>

            {/* Flow Diagram */}
            <div className="bg-white rounded-xl p-6 shadow-sm mt-4">
              <h3 className="font-bold text-sm mb-4">Signal → Payment Flow</h3>
              <div className="flex items-center gap-4 text-center">
                <div className="flex-1 bg-foam rounded-lg p-4">
                  <div className="text-2xl mb-2">📡</div>
                  <p className="font-bold text-sm">Listen</p>
                  <p className="text-xs text-steel mt-1">GitHub, APIs, oracles, onchain events</p>
                </div>
                <div className="text-2xl text-steel">→</div>
                <div className="flex-1 bg-surf/30 rounded-lg p-4">
                  <div className="text-2xl mb-2">🧠</div>
                  <p className="font-bold text-sm">Decide</p>
                  <p className="text-xs text-steel mt-1">Rule engine evaluates conditions</p>
                </div>
                <div className="text-2xl text-steel">→</div>
                <div className="flex-1 bg-mint/20 rounded-lg p-4">
                  <div className="text-2xl mb-2">💸</div>
                  <p className="font-bold text-sm">Pay</p>
                  <p className="text-xs text-steel mt-1">USDC via Circle Agent Stack</p>
                </div>
                <div className="text-2xl text-steel">→</div>
                <div className="flex-1 bg-sand rounded-lg p-4">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="font-bold text-sm">Settle</p>
                  <p className="text-xs text-steel mt-1">Sub-second finality on Arc</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => setShowNewRule(true)}
                className="bg-ocean text-sand rounded-xl p-5 text-left hover:bg-steel transition-colors"
              >
                <p className="font-bold text-lg">+ New Rule</p>
                <p className="text-xs opacity-70 mt-1">Create a new signal-to-payment rule</p>
              </button>
              <button className="bg-foam text-ocean rounded-xl p-5 text-left hover:bg-surf/30 transition-colors">
                <p className="font-bold text-lg">Fund Wallet</p>
                <p className="text-xs opacity-70 mt-1">Add USDC to agent wallet via faucet</p>
              </button>
            </div>
          </div>
        )}

        {/* RULES TAB */}
        {activeTab === "rules" && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Rules ({rules.length})</h3>
              <button
                onClick={() => setShowNewRule(true)}
                className="bg-ocean text-sand px-4 py-2 rounded-lg text-sm font-medium hover:bg-steel transition-colors"
              >
                + New Rule
              </button>
            </div>

            {rules.map(rule => (
              <div key={rule.id} className="bg-white rounded-xl p-5 shadow-sm flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold">{rule.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${signalSourceColors[rule.signal.source] || "bg-gray-200"}`}>
                      {rule.signal.source}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionTypeColors[rule.action.type] || "bg-gray-200"}`}>
                      {rule.action.type}
                    </span>
                  </div>
                  <p className="text-sm text-steel mb-2">{rule.description}</p>
                  <div className="flex gap-4 text-xs text-steel">
                    <span>Trigger: <code className="bg-gray-100 px-1 rounded">{rule.signal.trigger}</code></span>
                    <span>Amount: <strong>{rule.action.amount} {rule.action.currency}</strong></span>
                    <span>To: <code className="bg-gray-100 px-1 rounded">{rule.action.recipient.slice(0, 10)}...</code></span>
                    {rule.cooldown && <span>Cooldown: {rule.cooldown}s</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rule.enabled
                      ? "bg-mint/20 text-mint"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {rule.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && (
          <div className="mt-4">
            <h3 className="font-bold text-lg mb-4">Payment History</h3>
            {payments.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <p className="text-4xl mb-3">💳</p>
                <p className="font-bold text-steel">No payments yet</p>
                <p className="text-sm text-steel mt-1">Payments will appear here once rules trigger</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map(payment => (
                  <div key={payment.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{payment.rule}</p>
                      <p className="text-xs text-steel">{payment.recipient}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{payment.amount} USDC</p>
                      <p className={`text-xs ${payment.status === "confirmed" ? "text-mint" : payment.status === "failed" ? "text-coral" : "text-gold"}`}>
                        {payment.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Rule Modal */}
      {showNewRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewRule(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Create New Rule</h3>
            <form className="space-y-4">
              <div>
                <label className="text-xs font-medium text-steel">Rule Name</label>
                <input type="text" placeholder="e.g., Auto Bug Bounty" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-steel">Signal Source</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="github">GitHub</option>
                  <option value="api">External API</option>
                  <option value="oracle">Onchain Oracle</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-steel">Trigger Condition</label>
                <input type="text" placeholder="e.g., pull_request.merged" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-steel">Amount (USDC)</label>
                  <input type="number" placeholder="50" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-steel">Recipient</label>
                  <input type="text" placeholder="0x..." className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewRule(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-ocean text-sand rounded-lg text-sm font-medium hover:bg-steel">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
