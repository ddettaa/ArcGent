"use client";

import { useState } from "react";
import {
  Bot, Radio, Brain, Zap, CheckCircle, CreditCard, Plus, Power,
} from "lucide-react";

const C = {
  bg: "#f4f0e6",
  ink: "#0b1a33",
  ocean: "#1b3158",
  steel: "#2f578c",
  surf: "#acc6e9",
  mint: "#5acda7",
  coral: "#ff4b31",
  foam: "#d6f0e8",
  white: "#ffffff",
  border: "rgba(11,26,51,0.08)",
  borderLight: "rgba(11,26,51,0.04)",
};

const RULES = [
  { id: "1", name: "Auto Bug Bounty", desc: "Pay when PR with 'fix' label is merged", source: "github", trigger: "pull_request.merged", amount: 50, recipient: "0x1234...5678", type: "pay", enabled: false, cooldown: 3600 },
  { id: "2", name: "Flight Delay Refund", desc: "Refund when flight delayed > 2 hours", source: "api", trigger: "flight.delayed", amount: 100, recipient: "0xabcd...ef12", type: "refund", enabled: false, cooldown: 86400 },
  { id: "3", name: "Content Tip Stream", desc: "Tip writer when content hits 1000 reads", source: "api", trigger: "page.views", amount: 5, recipient: "0x9876...5432", type: "tip", enabled: false, cooldown: 604800 },
];

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  github: { bg: C.ocean, text: C.bg },
  api: { bg: C.coral, text: C.bg },
  oracle: { bg: C.surf, text: C.ink },
  webhook: { bg: "#f2a43a", text: C.ink },
};

const FLOW = [
  { icon: Radio, title: "Listen", desc: "GitHub, APIs, oracles, onchain events", bg: C.foam, color: C.ocean },
  { icon: Brain, title: "Decide", desc: "Rule engine evaluates conditions", bg: "rgba(172,198,233,0.25)", color: C.steel },
  { icon: Zap, title: "Pay", desc: "USDC via Circle Agent Stack", bg: "rgba(90,205,167,0.12)", color: C.mint },
  { icon: CheckCircle, title: "Settle", desc: "Sub-second finality on Arc", bg: C.bg, color: C.ocean },
];

export default function Dashboard() {
  const [rules, setRules] = useState(RULES);
  const [tab, setTab] = useState<"overview" | "rules" | "payments">("overview");
  const [showNew, setShowNew] = useState(false);

  const toggle = (id: string) => setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", color: C.ink }}>
      {/* HEADER — sticky like landing page */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(244,240,230,0.92)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: C.ocean, borderRadius: 8,
              display: "grid", placeItems: "center", color: C.bg, fontWeight: 900, fontSize: 13,
            }}>AG</div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>ArcGent</span>
              <span style={{ fontSize: 11, color: C.steel, marginLeft: 8, display: "inline" }}>Signal-to-Payment Agent</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              borderRadius: 999, background: "rgba(90,205,167,0.1)",
              border: `1px solid rgba(90,205,167,0.25)`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.mint, animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: C.mint }}>RUNNING</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>865M USDC</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>
        {/* TABS */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 0, marginBottom: 24 }}>
          {(["overview", "rules", "payments"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? C.ink : C.steel,
                background: tab === t ? C.white : "transparent",
                border: "none", borderBottom: tab === t ? `2px solid ${C.ocean}` : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit",
                borderRadius: tab === t ? "8px 8px 0 0" : "0",
                marginBottom: -1,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Active Rules", value: "4", icon: Bot },
                { label: "Wallet Balance", value: "865M USDC", icon: CreditCard, accent: C.mint },
                { label: "Last Signal Check", value: "2 min ago", icon: Radio },
                { label: "Network", value: "Arc Testnet", sub: "Chain ID: 5042002", icon: Zap },
              ].map((s, i) => (
                <div key={i} style={{
                  background: C.white, borderRadius: 14, padding: "20px 20px 16px",
                  border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(11,26,51,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <s.icon size={14} color={s.accent || C.steel} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.steel, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.accent || C.ink, letterSpacing: "-0.02em" }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: 11, color: C.steel, marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Flow */}
            <div style={{
              background: C.white, borderRadius: 14, padding: 24,
              border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(11,26,51,0.04)", marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, letterSpacing: "-0.01em" }}>Signal → Payment Flow</h3>
              <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
                {FLOW.map((step, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      flex: 1, background: step.bg, borderRadius: 10, padding: "16px 12px",
                      textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <step.icon size={22} color={step.color} strokeWidth={1.5} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{step.title}</div>
                        <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>{step.desc}</div>
                      </div>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div style={{ color: C.steel, opacity: 0.3, fontSize: 20, flexShrink: 0 }}>→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <button onClick={() => setShowNew(true)} style={{
                background: C.ocean, color: C.bg, borderRadius: 14, padding: "20px 22px",
                textAlign: "left", border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40, background: "rgba(244,240,230,0.15)", borderRadius: 10,
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <Plus size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>New Rule</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Create a signal-to-payment rule</div>
                </div>
              </button>
              <button style={{
                background: C.foam, color: C.ocean, borderRadius: 14, padding: "20px 22px",
                textAlign: "left", border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40, background: "rgba(27,49,88,0.1)", borderRadius: 10,
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Fund Wallet</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Add USDC via faucet</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* RULES TAB */}
        {tab === "rules" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Rules <span style={{ fontWeight: 400, fontSize: 14, color: C.steel }}>({rules.length})</span></h2>
              <button onClick={() => setShowNew(true)} style={{
                background: C.ocean, color: C.bg, padding: "8px 16px", borderRadius: 8,
                fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Plus size={14} /> New Rule
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rules.map(rule => {
                const sc = SOURCE_COLORS[rule.source] || { bg: "#ddd", text: "#333" };
                return (
                  <div key={rule.id} style={{
                    background: C.white, borderRadius: 14, padding: "18px 20px",
                    border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(11,26,51,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{rule.name}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                            background: sc.bg, color: sc.text,
                          }}>{rule.source}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                            border: `1px solid rgba(90,205,167,0.3)`, color: C.mint,
                          }}>{rule.type}</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.steel, margin: "0 0 8px" }}>{rule.desc}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: C.steel }}>
                          <span>Trigger: <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>{rule.trigger}</code></span>
                          <span style={{ fontWeight: 600, color: C.ink }}>{rule.amount} USDC</span>
                          <span>Cooldown: {rule.cooldown}s</span>
                        </div>
                      </div>
                      <button onClick={() => toggle(rule.id)} style={{
                        width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                        background: rule.enabled ? C.mint : "#e5e7eb", position: "relative", transition: "background 0.2s",
                      }}>
                        <span style={{
                          position: "absolute", top: 2, left: rule.enabled ? 24 : 2,
                          width: 20, height: 20, borderRadius: "50%", background: C.white,
                          transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <div style={{
            background: C.white, borderRadius: 14, padding: "64px 24px", textAlign: "center",
            border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(11,26,51,0.04)",
          }}>
            <CreditCard size={48} color={C.steel} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 style={{ fontWeight: 700, fontSize: 16, color: C.steel, margin: "0 0 4px" }}>No payments yet</h3>
            <p style={{ fontSize: 13, color: C.steel, margin: 0 }}>Payments will appear here once rules trigger</p>
          </div>
        )}
      </main>

      {/* MODAL */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{
          position: "fixed", inset: 0, background: "rgba(11,26,51,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.white, borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
            boxShadow: "0 25px 50px rgba(11,26,51,0.2)",
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 20px" }}>Create New Rule</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.steel, display: "block", marginBottom: 4 }}>Rule Name</label>
                <input placeholder="e.g. Auto Bug Bounty" style={{
                  width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.steel, display: "block", marginBottom: 4 }}>Signal Source</label>
                <select style={{
                  width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none", background: C.white,
                }}>
                  <option>GitHub</option><option>External API</option><option>Onchain Oracle</option><option>Webhook</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.steel, display: "block", marginBottom: 4 }}>Trigger Condition</label>
                <input placeholder="e.g. pull_request.merged" style={{
                  width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: C.steel, display: "block", marginBottom: 4 }}>Amount (USDC)</label>
                  <input type="number" placeholder="50" style={{
                    width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: C.steel, display: "block", marginBottom: 4 }}>Recipient</label>
                  <input placeholder="0x..." style={{
                    width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                  }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={() => setShowNew(false)} style={{
                  flex: 1, padding: "10px 16px", border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 13, fontWeight: 500, background: C.white, cursor: "pointer", fontFamily: "inherit",
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: "10px 16px", background: C.ocean, color: C.bg, borderRadius: 8,
                  fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>Create Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        ::selection { background: rgba(172,198,233,0.4); }
      `}} />
    </div>
  );
}
