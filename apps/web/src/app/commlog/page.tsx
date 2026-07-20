"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import {
  MessageSquare, ArrowRight, Bot, ExternalLink, Clock,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Filter, RefreshCw
} from "lucide-react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", surf: "#acc6e9", coral: "#ff4b31",
  mint: "#5acda7", gold: "#f2a43a", purple: "#9f72ff",
};

interface A2APayment {
  id: string; fromAgentId: string; toAgentId: string;
  serviceId: string; amount: number; units: number;
  status: string; timestamp: string; txHash?: string;
  metadata?: Record<string, any>;
}

const PAGE_SIZE = 10;

export default function CommLogPage() {
  const [payments, setPayments] = useState<A2APayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); fetchData(); const t = setInterval(fetchData, 15000); return () => clearInterval(t); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/payments/history");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.activity || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = payments.filter(p => {
    if (filter === "all") return true;
    if (filter === "completed") return p.status === "completed" || p.status === "confirmed";
    return p.status === "failed";
  });

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmt = (n: number) => (n / 1_000_000).toFixed(4);
  const agentNames: Record<string, string> = {
    "content-evaluator": "Content Evaluator",
    "translation-agent": "Translation Agent",
    "security-auditor": "Security Auditor",
  };

  const statusIcon = (s: string) => {
    if (s === "completed" || s === "confirmed") return <CheckCircle size={14} color={C.mint} />;
    if (s === "failed") return <XCircle size={14} color={C.coral} />;
    return <AlertCircle size={14} color={C.gold} />;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans','Inter',sans-serif", color: C.ink }}>
      <NavBar ctaLabel="Dashboard" ctaHref="/dashboard" />

      {/* DOT BG */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.04, backgroundImage: "radial-gradient(#0b1a33 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "40px 3%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(159,114,255,0.08)", border: "1px solid rgba(159,114,255,0.2)", borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: C.purple, marginBottom: 16 }}>
            <MessageSquare size={12} /> Agent-to-Agent
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>Communication Log</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: C.steel }}>Every agent-to-agent payment on Arc Network. Real transactions, real USDC.</p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "completed", "failed"] as const).map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                style={{ padding: "7px 14px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", border: "1px solid", borderColor: filter === f ? C.ocean : "rgba(11,26,51,0.1)", background: filter === f ? C.ocean : "white", color: filter === f ? "white" : C.steel }}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(11,26,51,0.1)", background: "white", color: C.steel }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)", padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel }}>Total Transactions</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 4 }}>{payments.length}</div>
          </div>
          <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)", padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel }}>Total Volume</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.mint, marginTop: 4 }}>{fmt(payments.reduce((s, p) => s + p.amount, 0))} <span style={{ fontSize: 11, color: C.steel }}>USDC</span></div>
          </div>
          <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)", padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.steel }}>Active Agents</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.purple, marginTop: 4 }}>{new Set(payments.map(p => p.fromAgentId)).size}</div>
          </div>
        </div>

        {/* Payment list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: C.steel }}>Loading...</div>
        ) : pageData.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)" }}>
            <Bot size={40} color={C.steel} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>No transactions yet</div>
            <div style={{ fontSize: 11, color: C.steel, marginTop: 4 }}>Hire an agent from the marketplace to see A2A payments</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pageData.map((p) => (
              <div key={p.id} style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                  {statusIcon(p.status)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.ink }}>
                      <span>{agentNames[p.fromAgentId] || p.fromAgentId}</span>
                      <ArrowRight size={12} color={C.steel} />
                      <span>{agentNames[p.toAgentId] || p.toAgentId || "external"}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>
                      {p.serviceId || "payment"} · <Clock size={9} style={{ display: "inline", verticalAlign: "-1px" }} /> {mounted ? new Date(p.timestamp).toLocaleString() : p.timestamp}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.mint }}>{fmt(p.amount)}</div>
                    <div style={{ fontSize: 9, color: C.steel }}>USDC</div>
                  </div>
                  {p.txHash && (
                    <a href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, fontSize: 9, fontWeight: 700, background: "rgba(47,87,140,0.08)", color: C.ocean, textDecoration: "none" }}>
                      TX <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(11,26,51,0.08)" }}>
            <div style={{ fontSize: 11, color: C.steel }}>
              Page <strong style={{ color: C.ink }}>{page}</strong> of {totalPages} · {filtered.length} transactions
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: page === 1 ? "default" : "pointer", border: "1px solid rgba(11,26,51,0.1)", background: "white", color: page === 1 ? C.steel : C.ink, opacity: page === 1 ? 0.5 : 1 }}>
                <ChevronLeft size={12} /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: page === totalPages ? "default" : "pointer", border: "1px solid rgba(11,26,51,0.1)", background: "white", color: page === totalPages ? C.steel : C.ink, opacity: page === totalPages ? 0.5 : 1 }}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}