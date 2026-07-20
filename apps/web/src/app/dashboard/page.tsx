"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useBalance } from 'wagmi';
import { NotificationToasts } from "@/components/Notifications";
import NavBar from "@/components/NavBar";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";
import { 
  Bot, Radio, Brain, Zap, CheckCircle, CreditCard, 
  Plus, RefreshCw, ExternalLink, Shield, ShieldAlert,
  X, Play, AlertTriangle, Clock, DollarSign, Sparkles,
  Cpu, Loader2, ArrowRight,
} from "lucide-react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158", steel: "#2f578c",
  surf: "#acc6e9", coral: "#ff4b31", mint: "#5acda7", gold: "#f2a43a",
  purple: "#9f72ff", foam: "#d6f0e8",
};

const ADMIN_KEY = "ag_dccd6ba82f242f3957dff7320e965c085c2e0bf166a170b4";

interface AgentStatus {
  status: string;
  balance: string;
  signalCheckCount?: number;
  paymentCount?: number;
  paymentsExecuted?: number;
  uptime: number;
  pendingApprovals?: number;
}

interface AgentRule {
  id: string;
  name: string;
  signalSource: string;
  signalTrigger: string;
  signalConditions: Record<string,any>;
  actionType: string;
  actionRecipient: string;
  actionAmount: number;
  actionCurrency?: string;
  actionMemo?: string;
  enabled: boolean;
  cooldown?: number;
}

interface Payment {
  id: string;
  ruleId: string;
  to: string;
  amount: number;
  status: string;
  timestamp: string;
  txHash?: string;
  approvalTier?: string;
  approvalId?: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [newRule, setNewRule] = useState({ name: "", source: "github", trigger: "", amount: "", recipient: "" });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rulesPage, setRulesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [myAgent, setMyAgent] = useState<any>(null);
  const [myAgentBalance, setMyAgentBalance] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // User's connected wallet
  const { address: userAddress, isConnected: userConnected } = useAccount();
  const { data: userBalance } = useBalance({ address: userAddress });
  useEffect(() => { setMounted(true); }, []);

  // Fetch user's agent + balance
  useEffect(() => {
    if (!userAddress) return;
    const wallet = userAddress;
    
    // Get session token
    let authHeader: Record<string,string> = { "X-Wallet-Address": wallet };
    const session = localStorage.getItem("arcgent_session");
    if (session) {
      try {
        const s = JSON.parse(session);
        if (s.sessionToken && s.expiresAt > Date.now()) {
          authHeader["Authorization"] = `Bearer ${s.sessionToken}`;
        }
      } catch {}
    }
    
    fetch(`/api/my-agent?walletAddress=${wallet}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then(agent => {
        setMyAgent(agent);
        if (agent?.walletAddress) {
          fetch("/api/status", { headers: authHeader })
            .then(r => r.ok ? r.json() : null)
            .then(s => setMyAgentBalance(s?.balance || "0.00"));
        }
      })
      .catch(() => setMyAgent(null));
  }, [userAddress]);

  const fetchData = useCallback(async () => {
    try {
      // Use session token from login, fallback to wallet header
      let authHeader: Record<string,string> = {};
      const session = localStorage.getItem("arcgent_session");
      if (session) {
        try {
          const s = JSON.parse(session);
          if (s.sessionToken && s.expiresAt > Date.now()) {
            authHeader["Authorization"] = `Bearer ${s.sessionToken}`;
          }
        } catch {}
      }
      if (!authHeader["Authorization"] && userAddress) {
        authHeader["X-Wallet-Address"] = userAddress;
      }
      
      const [sRes, rRes, pRes, aRes] = await Promise.all([
        fetch("/api/status", { headers: authHeader }).then(r => r.ok ? r.json() : null),
        fetch("/api/rules", { headers: authHeader }).then(r => r.ok ? r.json() : []),
        fetch("/api/payments", { headers: authHeader }).then(r => r.ok ? r.json() : []),
        fetch("/api/approvals", { headers: authHeader }).then(r => r.ok ? r.json() : []),
      ]);
      if (sRes) setStatus(sRes);
      setRules(rRes || []);
      setPayments(pRes || []);
      setApprovals(aRes || []);
      setLastUpdate(Date.now());
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch:", e);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleRule = async (id: string, currentEnabled: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !currentEnabled } : r));
    try { await fetch(`/api/rules/${id}/toggle`, { method: "POST" }); }
    catch { setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: currentEnabled } : r)); }
  };

  const addRule = async () => {
    if (!newRule.name || !newRule.trigger || !newRule.amount || !newRule.recipient) return;
    const rule = {
      id: `rule_${Date.now()}`,
      name: newRule.name,
      signalSource: newRule.source as any,
      signalTrigger: newRule.trigger,
      signalConditions: {},
      actionType: "pay",
      actionRecipient: newRule.recipient,
      actionAmount: parseFloat(newRule.amount),
      enabled: true, cooldown: 3600,
    };
    try {
      const res = await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) });
      if (res.ok) { const saved = await res.json(); setRules(prev => [...prev, saved]); setShowModal(false); setNewRule({ name: "", source: "github", trigger: "", amount: "", recipient: "" }); }
    } catch (e) { console.error(e); }
  };

  const simulateSignal = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ADMIN_KEY}`,
        },
        body: JSON.stringify({
          signal: "webhook",
          trigger: "pr_merged",
          metadata: { repo: "arcgent/demo", pr: 42, author: "dev" },
        }),
      });
      const data = await res.json();
      setSimResult(data);
      setTimeout(() => { setSimResult(null); fetchData(); }, 5000);
    } catch (e: any) {
      setSimResult({ success: false, message: e.message, trace: [] });
      setTimeout(() => setSimResult(null), 3000);
    }
    setSimulating(false);
  };

  const killSwitch = async () => {
    setActionLoading("kill");
    try {
      const res = await fetch("/api/my-agent/kill", { 
        method: "POST",
        headers: userAddress ? { "X-Wallet-Address": userAddress } : {},
      });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const revive = async () => {
    setActionLoading("revive");
    try {
      const res = await fetch("/api/my-agent/revive", { 
        method: "POST",
        headers: userAddress ? { "X-Wallet-Address": userAddress } : {},
      });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const approvePayment = async (id: string) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`/api/approvals/${id}/approve`, { method: "POST" });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const rejectPayment = async (id: string) => {
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`/api/approvals/${id}/reject`, { method: "POST" });
      if (res.ok) fetchData();
    } catch {}
    setActionLoading(null);
  };

  const sourceBadge: Record<string, { bg: string; text: string }> = {
    github: { bg: C.ocean, text: "white" },
    api: { bg: C.coral, text: "white" },
    webhook: { bg: C.mint, text: C.ink },
    oracle: { bg: C.purple, text: "white" },
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s%60}s`;
  };

  const statCard = (label: string, value: string | number, sub: string, color: string, icon?: React.ReactNode) => (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(11,26,51,0.08)", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, color: C.steel, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.steel, marginTop: 4 }}>{sub}</div>
    </div>
  );

  const activeRules = rules.filter(r => r.enabled).length;
  const isKilled = status?.status === "KILLED";
  const confirmedCount = payments.filter(p => p.status === "confirmed").length;
  const pendingApprovals = approvals.filter((a: any) => a.status === "pending_review" || a.status === "pending_manual").length;

  function ForRole({ role, children }: { role: string; children: React.ReactNode }) {
    // TODO: wire to login session. Defaults to admin for now
    const currentRole = (typeof window !== "undefined" && sessionStorage.getItem("arc_role")) || "admin";
    const level: Record<string, number> = { viewer: 0, operator: 1, admin: 2 };
    if ((level[currentRole] || 0) < (level[role] || 0)) return null;
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans', sans-serif", color: C.ink }} suppressHydrationWarning>
      <NavBar ctaLabel="Get Started" ctaHref="/onboarding" />
      <NotificationToasts />
      {/* HEADER */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 3%", background: isKilled ? "linear-gradient(135deg, #8b0000, #cc0000)" : "rgba(11,26,51,0.95)",
        backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)",
        transition: "background 0.5s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "grid", placeItems: "center", width: 36, height: 36, background: isKilled ? C.coral : C.ocean, borderRadius: 8 }}>
            {isKilled ? <ShieldAlert size={18} color="white" /> : <Bot size={18} color="white" />}
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.03em" }}>ArcGent</span>
          <div style={{ display: "flex", gap: 8, marginLeft: 20 }}>
            <a href="/marketplace" style={{ 
              padding: "6px 12px", background: "rgba(255,255,255,0.1)", color: "white", 
              textDecoration: "none", borderRadius: 4, fontSize: 10, fontWeight: 700 
            }}>
              Marketplace
            </a>
            <a href="/analytics" style={{ 
              padding: "6px 12px", background: "rgba(255,255,255,0.1)", color: "white", 
              textDecoration: "none", borderRadius: 4, fontSize: 10, fontWeight: 700 
            }}>
              Analytics
            </a>
          </div>
          <span style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: isKilled ? C.coral : status?.status === "RUNNING" ? C.mint : C.gold,
            color: C.ink, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isKilled ? "white" : status?.status === "RUNNING" ? C.ink : C.coral, animation: status?.status === "RUNNING" ? "pulse 2s infinite" : "none" }} />
            {status?.status || "CONNECTING"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {pendingApprovals > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: C.gold, borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.ink }}>
              <Clock size={14} /> {pendingApprovals} pending approval
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* User Wallet */}
            {mounted && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: C.steel, textTransform: "uppercase", letterSpacing: "0.05em" }}>👤 My Wallet</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.surf }}>
                  {userConnected && userAddress 
                    ? `${userBalance ? (Number(userBalance.value) / 10 ** userBalance.decimals).toFixed(2) : "0.00"} USDC`
                    : "Not connected"}
                </div>
                {userConnected && userAddress && (
                  <div style={{ fontSize: 9, color: C.steel }}>{userAddress.slice(0,6)}...{userAddress.slice(-4)}</div>
                )}
              </div>
            )}
            {/* Divider */}
            <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.15)" }} />
            {/* Agent Wallet */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: C.steel, textTransform: "uppercase", letterSpacing: "0.05em" }}>🤖 My Agent</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>
                {myAgentBalance !== null ? myAgentBalance : (status?.balance || "—")} USDC
              </div>
              {myAgent && (
                <div style={{ fontSize: 9, color: C.steel }}>{myAgent.name}</div>
              )}
              <div style={{ fontSize: 10, color: C.steel }}>Arc Testnet · {mounted ? formatUptime(status?.uptime || 0) : "—"}</div>
            </div>
          </div>
          {/* SIMULATE SIGNAL BUTTON */}
          <button onClick={simulateSignal} disabled={simulating} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "rgba(242,164,58,0.2)", color: C.gold, border: "1px solid rgba(242,164,58,0.4)", borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            opacity: simulating ? 0.6 : 1,
          }}>
            <Zap size={14} /> {simulating ? "Running..." : "🚀 Simulate Signal"}
          </button>
          {/* KILL / REVIVE */}
          {isKilled ? (
            <button onClick={revive} disabled={actionLoading === "revive"} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: C.mint, color: C.ink, border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: actionLoading === "revive" ? 0.6 : 1,
            }}>
              <Play size={14} /> REVIVE
            </button>
          ) : (
            <button onClick={killSwitch} disabled={actionLoading === "kill"} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: "rgba(255,75,49,0.15)", color: C.coral, border: "1px solid rgba(255,75,49,0.3)", borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: actionLoading === "kill" ? 0.6 : 1,
            }}>
              <ShieldAlert size={14} /> KILL SWITCH
            </button>
          )}
          <button onClick={fetchData} style={{ padding: 8, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, cursor: "pointer" }}>
            <RefreshCw size={14} color="white" />
          </button>
        </div>
      </header>

      {isKilled && (
        <div style={{ padding: "12px 3%", background: "rgba(255,75,49,0.08)", borderBottom: "1px solid rgba(255,75,49,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <AlertTriangle size={16} color={C.coral} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.coral }}>EMERGENCY STOP ACTIVE — All payments halted. Press REVIVE to resume.</span>
        </div>
      )}

      <div style={{ padding: "24px 3%", maxWidth: 1200, margin: "0 auto" }}>
        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {statCard("Active Rules", `${activeRules} / ${rules.length}`, activeRules > 0 ? "Monitoring signals" : "No rules active", C.ocean, <Radio size={16} color={C.ocean} />)}
          {statCard("USDC Balance", status?.balance || "—", "Arc Testnet", C.mint, <CreditCard size={16} color={C.mint} />)}
          {statCard("Signal Checks", status?.signalCheckCount || 0, `Every 10s`, C.gold, <Zap size={16} color={C.gold} />)}
          {statCard("Payments", `${confirmedCount} / ${payments.length}`, `${pendingApprovals} pending approval`, C.purple, <CheckCircle size={16} color={C.purple} />)}
        </div>

        {/* SIMULATE RESULT TOAST */}
        {simResult && (
          <div style={{
            background: simResult.success ? "rgba(90,205,167,0.08)" : "rgba(255,75,49,0.08)",
            border: `1px solid ${simResult.success ? "rgba(90,205,167,0.3)" : "rgba(255,75,49,0.3)"}`,
            borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: simResult.trace?.length ? 12 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{simResult.success ? "🎉" : "⚠️"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: simResult.success ? C.mint : C.coral }}>
                    {simResult.message}
                  </div>
                  {simResult.ai && (
                    <div style={{ fontSize: 11, color: C.steel, marginTop: 2 }}>
                      AI Confidence: {simResult.ai.confidence}% · {simResult.ai.reasoning}
                    </div>
                  )}
                </div>
              </div>
              {simResult.executed?.[0]?.txHash && (
                <a href={`https://testnet.arcscan.app/tx/${simResult.executed[0].txHash}`} target="_blank" style={{ fontSize: 10, fontWeight: 700, color: C.purple, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  View TX <ExternalLink size={10} />
                </a>
              )}
            </div>
            {simResult.trace?.length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(11,26,51,0.03)", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
                {simResult.trace.map((t: string, i: number) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: C.ink, padding: "2px 0" }}>
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KILL SWITCH BANNER */}
        <div style={{ background: "white", borderRadius: 12, border: `1px solid ${isKilled ? C.coral : "rgba(11,26,51,0.08)"}`, padding: 20, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isKilled ? "rgba(255,75,49,0.1)" : "rgba(90,205,167,0.1)", display: "grid", placeItems: "center" }}>
              {isKilled ? <ShieldAlert size={20} color={C.coral} /> : <Shield size={20} color={C.mint} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isKilled ? C.coral : C.ink }}>{isKilled ? "KILL SWITCH ENGAGED" : "Kill Switch Ready"}</div>
              <div style={{ fontSize: 11, color: C.steel }}>{isKilled ? "No payments will be executed. Press REVIVE to resume." : "Emergency stop for all payments. Requires admin auth."}</div>
            </div>
          </div>
          {isKilled ? (
            <button onClick={revive} disabled={actionLoading === "revive"} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
              background: C.mint, color: C.ink, border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <Play size={16} /> Resume Agent
            </button>
          ) : (
            <button onClick={killSwitch} disabled={actionLoading === "kill"} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
              background: C.coral, color: "white", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <ShieldAlert size={16} /> Stop All Payments
            </button>
          )}
        </div>

        {/* PENDING APPROVALS */}
        {pendingApprovals > 0 && (
          <div style={{ background: "white", borderRadius: 12, border: `1px solid rgba(242,164,58,0.3)`, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Clock size={16} color={C.gold} />
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>Pending Approvals ({pendingApprovals})</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {approvals.filter((a: any) => a.status === "pending_review" || a.status === "pending_manual").map((a: any) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(242,164,58,0.06)", borderRadius: 8, border: "1px solid rgba(242,164,58,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <DollarSign size={18} color={C.gold} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {a.amount} USDC → {a.recipient?.slice(0, 6)}...{a.recipient?.slice(-4)} 
                        <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: a.tier === "MANUAL" ? C.coral : C.gold, color: "white" }}>{a.tier}</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.steel }}>{mounted ? new Date(a.createdAt).toLocaleString() : a.createdAt}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => rejectPayment(a.id)} disabled={actionLoading === `reject-${a.id}`} style={{
                      padding: "6px 14px", background: "rgba(255,75,49,0.1)", color: C.coral, border: "1px solid rgba(255,75,49,0.2)", borderRadius: 6,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                      <X size={14} style={{ marginRight: 4, display: "inline", verticalAlign: "middle" }} />
                      Reject
                    </button>
                    <button onClick={() => approvePayment(a.id)} disabled={actionLoading === `approve-${a.id}`} style={{
                      padding: "6px 14px", background: C.mint, color: C.ink, border: "none", borderRadius: 6,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                      <CheckCircle size={14} style={{ marginRight: 4, display: "inline", verticalAlign: "middle" }} />
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FLOW */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(11,26,51,0.08)", padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16, color: C.steel }}>Signal → Payment Flow</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {[
              { icon: Radio, l: "Listen", d: "GitHub | API | Webhook", c: C.ocean },
              { icon: Brain, l: "Decide", d: "Rule engine + approval", c: C.coral },
              { icon: Zap, l: "Pay", d: "USDC via Circle", c: C.mint },
              { icon: CheckCircle, l: "Settle", d: "Arc Testnet confirmed", c: C.purple },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {i > 0 && <span style={{ color: C.surf, fontSize: 18 }}>→</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: s.c, borderRadius: 10, color: s.c === C.mint ? C.ink : "white" }}>
                  <s.icon size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{s.l}</div>
                    <div style={{ fontSize: 9, opacity: 0.8 }}>{s.d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI BRAIN — LIVE EVALUATION */}
        <ForRole role="operator">
          <AIEvaluationPanel />
        </ForRole>

        {/* RISK MANAGEMENT */}
        <ForRole role="operator">
          <RiskPanel />
        </ForRole>

        {/* RULES */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(11,26,51,0.08)", padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: C.steel }}>Rules ({rules.length})</div>
            <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: C.ocean, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <Plus size={14} /> New Rule
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 40 }}>
              <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
              </div>
              <SkeletonTable rows={4} cols={4} />
            </div>
          ) : rules.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.steel, fontSize: 13 }}>No rules configured yet. Create one to start automating payments.</div>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rules.slice((rulesPage - 1) * ITEMS_PER_PAGE, rulesPage * ITEMS_PER_PAGE).map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: (sourceBadge[r.signalSource] || sourceBadge.github).bg, color: (sourceBadge[r.signalSource] || sourceBadge.github).text, textTransform: "uppercase" }}>
                      {r.signalSource}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: C.steel }}>{r.signalTrigger} → {r.actionAmount} USDC</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.ocean }}>{r.actionAmount} USDC</span>
                    <button onClick={() => toggleRule(r.id, r.enabled)} style={{
                      padding: "6px 16px", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                      background: r.enabled ? C.mint : "rgba(11,26,51,0.08)", color: r.enabled ? C.ink : C.steel,
                      transition: "all 0.2s",
                    }}>
                      {r.enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              ))}
              </div>
              {rules.length > ITEMS_PER_PAGE && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(11,26,51,0.06)" }}>
                  <div style={{ fontSize: 10, color: C.steel }}>Page {rulesPage} of {Math.ceil(rules.length / ITEMS_PER_PAGE)} · {rules.length} rules</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setRulesPage(p => Math.max(1, p - 1))} disabled={rulesPage === 1} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700, border: "1px solid rgba(11,26,51,0.1)", background: "white", color: rulesPage === 1 ? C.steel : C.ink, cursor: rulesPage === 1 ? "default" : "pointer", opacity: rulesPage === 1 ? 0.5 : 1 }}>← Prev</button>
                    <button onClick={() => setRulesPage(p => Math.min(Math.ceil(rules.length / ITEMS_PER_PAGE), p + 1))} disabled={rulesPage >= Math.ceil(rules.length / ITEMS_PER_PAGE)} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700, border: "1px solid rgba(11,26,51,0.1)", background: "white", color: C.ink, cursor: "pointer" }}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PAYMENTS */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(11,26,51,0.08)", padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16, color: C.steel }}>Payment History ({payments.length})</div>
          {payments.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.steel, fontSize: 13 }}>No payments yet. Trigger a rule to see transactions here.</div>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {payments.slice().reverse().slice((paymentsPage - 1) * ITEMS_PER_PAGE, paymentsPage * ITEMS_PER_PAGE).map(p => {
                const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
                  confirmed: { bg: "rgba(90,205,167,0.1)", text: C.mint, icon: <CheckCircle size={14} color={C.mint} /> },
                  pending: { bg: "rgba(242,164,58,0.1)", text: C.gold, icon: <Clock size={14} color={C.gold} /> },
                  review: { bg: "rgba(242,164,58,0.1)", text: C.gold, icon: <Clock size={14} color={C.gold} /> },
                  manual: { bg: "rgba(159,114,255,0.1)", text: C.purple, icon: <AlertTriangle size={14} color={C.purple} /> },
                  failed: { bg: "rgba(255,75,49,0.1)", text: C.coral, icon: <X size={14} color={C.coral} /> },
                };
                const sc = statusColors[p.status] || statusColors.failed;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: sc.bg, borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {sc.icon}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.amount} USDC → {p.to?.slice(0, 6)}...{p.to?.slice(-4)}</div>
                        <div style={{ fontSize: 10, color: C.steel }}>{mounted ? new Date(p.timestamp).toLocaleString() : p.timestamp}{p.approvalTier ? ` · ${p.approvalTier}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sc.text, color: "white" }}>{p.status}</span>
                      {p.txHash && (
                        <a href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: C.ocean, display: "flex" }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
              {payments.length > ITEMS_PER_PAGE && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(11,26,51,0.06)" }}>
                  <div style={{ fontSize: 10, color: C.steel }}>Page {paymentsPage} of {Math.ceil(payments.length / ITEMS_PER_PAGE)} · {payments.length} payments</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setPaymentsPage(p => Math.max(1, p - 1))} disabled={paymentsPage === 1} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700, border: "1px solid rgba(11,26,51,0.1)", background: "white", color: paymentsPage === 1 ? C.steel : C.ink, cursor: paymentsPage === 1 ? "default" : "pointer", opacity: paymentsPage === 1 ? 0.5 : 1 }}>← Prev</button>
                    <button onClick={() => setPaymentsPage(p => Math.min(Math.ceil(payments.length / ITEMS_PER_PAGE), p + 1))} disabled={paymentsPage >= Math.ceil(payments.length / ITEMS_PER_PAGE)} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700, border: "1px solid rgba(11,26,51,0.1)", background: "white", color: C.ink, cursor: "pointer" }}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: C.steel, textAlign: "right", marginTop: 8 }}>
          Auto-refresh every 15s · Last: {mounted ? new Date(lastUpdate).toLocaleTimeString() : "—"}
        </div>
      </div>

      {/* NEW RULE MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,26,51,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowModal(false)}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 900 }}>Create New Rule</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Rule Name</label>
                <input placeholder="e.g., Auto Bug Bounty #42" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Signal Source</label>
                <select value={newRule.source} onChange={e => setNewRule({ ...newRule, source: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}>
                  <option value="github">GitHub</option>
                  <option value="api">API</option>
                  <option value="webhook">Webhook</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Trigger Condition</label>
                <input placeholder="e.g., PR merged with label bugfix" value={newRule.trigger} onChange={e => setNewRule({ ...newRule, trigger: e.target.value })}
                  style={{ width: "100%", padding: 10, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Amount (USDC)</label>
                  <input type="number" placeholder="50" value={newRule.amount} onChange={e => setNewRule({ ...newRule, amount: e.target.value })}
                    style={{ width: "100%", padding: 10, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Recipient Wallet</label>
                  <input placeholder="0x..." value={newRule.recipient} onChange={e => setNewRule({ ...newRule, recipient: e.target.value })}
                    style={{ width: "100%", padding: 10, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>
              <button onClick={addRule} style={{ padding: 12, background: C.ocean, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes spin{to{transform:rotate(360deg)}}` }} />
      <NotificationToasts />
    </div>
  );
}

// --- AI EVALUATION PANEL ---
function AIEvaluationPanel() {
  const [aiInput, setAiInput] = useState({ type: "bug_bounty", title: "", description: "", details: "" });
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runAI = async () => {
    if (!aiInput.title || !aiInput.description) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: "dashboard-eval",
          type: aiInput.type,
          title: aiInput.title,
          description: aiInput.description,
          rawData: JSON.parse(aiInput.details || "{}"),
        }),
      });
      const data = await res.json();
      setAiResult(data);
    } catch (e) {
      setAiResult({ error: "Evaluation failed" });
    }
    setAiLoading(false);
  };

  const severityColors: Record<string, string> = {
    critical: C.coral, high: "#ff6b35", medium: C.gold, low: C.mint, trivial: C.steel,
  };

  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(159,114,255,0.3)", padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Cpu size={18} color={C.purple} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>🧠 AI Evaluation</div>
        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: C.purple, color: "white" }}>LLM</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Input */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Scenario Type</label>
          <select value={aiInput.type} onChange={e => setAiInput({ ...aiInput, type: e.target.value })}
            style={{ width: "100%", padding: 8, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}>
            <option value="bug_bounty">Bug Bounty</option>
            <option value="content_review">Content Review</option>
            <option value="dispute">Dispute Resolution</option>
            <option value="generic">Generic</option>
          </select>

          <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Title</label>
          <input placeholder="e.g., Fix reentrancy vulnerability" value={aiInput.title} onChange={e => setAiInput({ ...aiInput, title: e.target.value })}
            style={{ width: "100%", padding: 8, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: "border-box" }} />

          <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Description</label>
          <textarea placeholder="Describe the change or content..." value={aiInput.description} onChange={e => setAiInput({ ...aiInput, description: e.target.value })}
            style={{ width: "100%", padding: 8, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, minHeight: 80, resize: "vertical", marginBottom: 8, boxSizing: "border-box", fontFamily: "inherit" }} />

          <label style={{ fontSize: 11, fontWeight: 700, color: C.steel, display: "block", marginBottom: 4 }}>Details (JSON)</label>
          <input placeholder='{"author":"alice","contributions":8}' value={aiInput.details} onChange={e => setAiInput({ ...aiInput, details: e.target.value })}
            style={{ width: "100%", padding: 8, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginBottom: 12, boxSizing: "border-box" }} />

          <button onClick={runAI} disabled={aiLoading} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
            background: C.purple, color: "white", border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", justifyContent: "center",
            opacity: aiLoading ? 0.7 : 1,
          }}>
            {aiLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
            {aiLoading ? "AI Thinking..." : "Evaluate with AI"}
          </button>
        </div>

        {/* Output */}
        <div>
          {aiResult ? (
            <div style={{ padding: 16, background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)", height: "100%", boxSizing: "border-box" }}>
              {aiResult.error ? (
                <div style={{ color: C.coral, fontSize: 13 }}>{aiResult.error}</div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, display: "grid", placeItems: "center",
                      background: aiResult.approved ? "rgba(90,205,167,0.15)" : "rgba(255,75,49,0.15)",
                    }}>
                      {aiResult.approved ? <CheckCircle size={24} color={C.mint} /> : <X size={24} color={C.coral} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: aiResult.approved ? C.mint : C.coral }}>
                        {aiResult.approved ? "APPROVED" : "REJECTED"}
                      </div>
                      {aiResult.approved && (
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.purple }}>
                          {aiResult.amount} USDC
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(159,114,255,0.1)", color: C.purple }}>
                      {aiResult.confidence}% confidence
                    </span>
                    {aiResult.severity && (
                      <span style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: (severityColors[aiResult.severity] || C.steel) + "20",
                        color: severityColors[aiResult.severity] || C.steel,
                      }}>
                        {aiResult.severity.toUpperCase()}
                      </span>
                    )}
                    {aiResult.tokensUsed && (
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(11,26,51,0.06)", color: C.steel }}>
                        {aiResult.tokensUsed} tokens
                      </span>
                    )}
                  </div>

                  <div style={{
                    padding: 12, background: "rgba(11,26,51,0.03)", borderRadius: 6,
                    fontSize: 12, color: C.ink, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700, color: C.steel, fontSize: 10, display: "block", marginBottom: 4 }}>AI REASONING</span>
                    {aiResult.reasoning}
                  </div>

                  {aiResult.model && (
                    <div style={{ fontSize: 9, color: C.steel, marginTop: 8 }}>
                      Model: {aiResult.model}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: C.steel, fontSize: 13, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(11,26,51,0.15)", borderRadius: 8, boxSizing: "border-box" }}>
              <Cpu size={32} color={C.surf} style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600 }}>AI Evaluation Result</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Fill the form and click Evaluate</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- RISK MANAGEMENT PANEL ---
function RiskPanel() {
  const [risk, setRisk] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ dailyCap: "", perTxMax: "", perRuleCap: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchRisk(); const t = setInterval(fetchRisk, 10000); return () => clearInterval(t); }, []);

  const fetchRisk = async () => {
    try {
      const res = await fetch("/api/risk");
      if (res.ok) setRisk(await res.json());
    } catch {}
  };

  const fmtUsdc = (micro: number) => (micro / 1_000_000).toFixed(4);
  const utilization = risk?.utilization || 0;
  const barColor = utilization > 80 ? C.coral : utilization > 50 ? C.gold : C.mint;

  const saveLimits = async () => {
    const body: any = {};
    if (form.dailyCap) body.dailyCap = parseFloat(form.dailyCap) * 1_000_000;
    if (form.perTxMax) body.perTxMax = parseFloat(form.perTxMax) * 1_000_000;
    if (form.perRuleCap) body.perRuleCap = parseFloat(form.perRuleCap) * 1_000_000;
    try {
      const res = await fetch("/api/risk/limits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setMsg("✅ Limits updated"); setEditing(false); fetchRisk(); }
      else setMsg("❌ Failed");
    } catch { setMsg("❌ Error"); }
    setTimeout(() => setMsg(""), 3000);
  };

  if (!risk) return null;

  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(11,26,51,0.08)", padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: C.steel }}>🛡️ Risk Management</div>
        <button onClick={() => setEditing(!editing)} style={{ padding: "6px 12px", background: C.ocean, color: "white", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
          {editing ? "Cancel" : "Edit Limits"}
        </button>
      </div>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, marginBottom: 12, background: msg.startsWith("✅") ? "rgba(90,205,167,0.1)" : "rgba(255,75,49,0.1)", color: msg.startsWith("✅") ? C.mint : C.coral }}>{msg}</div>}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
          <span style={{ color: C.steel }}>Daily Spending</span>
          <span style={{ fontWeight: 800, color: C.ink }}>{fmtUsdc(risk.dailySpent)} / {fmtUsdc(risk.dailyCap)} USDC</span>
        </div>
        <div style={{ height: 8, background: "rgba(11,26,51,0.06)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(utilization, 100)}%`, background: barColor, borderRadius: 4, transition: "width 0.5s" }} />
        </div>
        <div style={{ fontSize: 9, color: C.steel, marginTop: 4 }}>{utilization}% utilized · {fmtUsdc(risk.dailyRemaining)} remaining</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: editing ? 16 : 0 }}>
        <div style={{ padding: "12px 14px", background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel, marginBottom: 4 }}>Daily Cap</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{fmtUsdc(risk.dailyCap)}</div>
          <div style={{ fontSize: 9, color: C.steel }}>USDC/day total</div>
        </div>
        <div style={{ padding: "12px 14px", background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel, marginBottom: 4 }}>Per TX Max</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{fmtUsdc(risk.perTxMax)}</div>
          <div style={{ fontSize: 9, color: C.steel }}>USDC per transaction</div>
        </div>
        <div style={{ padding: "12px 14px", background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel, marginBottom: 4 }}>Per Rule Cap</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{fmtUsdc(risk.perRuleCap)}</div>
          <div style={{ fontSize: 9, color: C.steel }}>USDC/day per rule</div>
        </div>
      </div>

      {editing && (
        <div style={{ padding: 16, background: "rgba(11,26,51,0.02)", borderRadius: 8, border: "1px solid rgba(11,26,51,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: C.steel, textTransform: "uppercase" }}>Daily Cap (USDC)</label>
              <input value={form.dailyCap} onChange={e => setForm({...form, dailyCap: e.target.value})} placeholder={fmtUsdc(risk.dailyCap)} style={{ width: "100%", padding: "8px 10px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: C.steel, textTransform: "uppercase" }}>Per TX Max (USDC)</label>
              <input value={form.perTxMax} onChange={e => setForm({...form, perTxMax: e.target.value})} placeholder={fmtUsdc(risk.perTxMax)} style={{ width: "100%", padding: "8px 10px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: C.steel, textTransform: "uppercase" }}>Per Rule Cap (USDC)</label>
              <input value={form.perRuleCap} onChange={e => setForm({...form, perRuleCap: e.target.value})} placeholder={fmtUsdc(risk.perRuleCap)} style={{ width: "100%", padding: "8px 10px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, marginTop: 4 }} />
            </div>
          </div>
          <button onClick={saveLimits} style={{ padding: "10px 20px", background: C.mint, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Save Limits</button>
        </div>
      )}
    </div>
  );
}
