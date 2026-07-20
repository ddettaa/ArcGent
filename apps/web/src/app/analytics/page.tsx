"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  BarChart3, Activity, DollarSign, Zap, Bot,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Calendar, Download, ChevronLeft, ChevronRight,
} from "lucide-react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", surf: "#acc6e9", coral: "#ff4b31",
  mint: "#5acda7", gold: "#f2a43a", purple: "#9f72ff",
};

const ITEMS_PER_PAGE = 8;

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map((row: any) => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface PaymentStats {
  totalVolume: number;
  totalPayments: number;
  averageAmount: number;
  topEarners: Array<{ agentId: string; earned: number }>;
  topSpenders: Array<{ agentId: string; spent: number }>;
  dailyVolume: Array<{ date: string; volume: number; transactions: number }>;
}

interface ActivityItem {
  id: string; type: "earned" | "spent";
  agentId: string; amount: number; service: string;
  timestamp: string; txHash?: string; status?: string;
}

interface HistoryResponse {
  totalVolume: number;
  totalPayments: number;
  averageAmount: number;
  dailyVolume: Array<{ date: string; volume: number; transactions: number }>;
  activity: ActivityItem[];
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); fetchAnalytics(); }, [timeRange]);
  const totalPages = Math.max(Math.ceil(activity.length / ITEMS_PER_PAGE), 1);
  const pageActivity = activity.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/payments/history");
      if (res.ok) {
        const data: HistoryResponse = await res.json();
        setStats({
          totalVolume: data.totalVolume,
          totalPayments: data.totalPayments,
          averageAmount: data.averageAmount,
          topEarners: [], // computed from agent stats separately
          topSpenders: [],
          dailyVolume: data.dailyVolume,
        });
        setActivity(data.activity);
      }
      // Also fetch agent stats for top earners/spenders
      const statsRes = await fetch("/api/agents/stats");
      if (statsRes.ok) {
        const agentStats = await statsRes.json();
        setStats(prev => prev ? {
          ...prev,
          topEarners: agentStats.topEarners || [],
          topSpenders: agentStats.topSpenders || [],
        } : prev);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fmt = (n: number) => (n / 1000000).toFixed(4);
  const maxVol = Math.max(...(stats?.dailyVolume?.map(d => d.volume) || [1]));

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.sand, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <BarChart3 size={40} color={C.purple} style={{ margin: "0 auto 12px", animation: "pulse 2s infinite" }} />
        <div style={{ fontSize: 13, color: C.steel, fontWeight: 600 }}>Loading analytics...</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans','Inter',sans-serif", color: C.ink }}>
      {/* DOT BG */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(11,26,51,0.06) 0.7px, transparent 0.7px)", backgroundSize: "16px 16px" }} />

      {/* NAV */}
      <NavBar
        ctaLabel="Export"
        ctaHref="#"
        ctaClick={() => downloadCSV(activity, `arcgent-analytics-${timeRange}.csv`)}
        extraLinks={[
          { href: "#", label: `${timeRange === "24h" ? "24H" : timeRange === "7d" ? "7D" : "30D"}` }
        ]}
      />

      {/* PAGE TITLE */}
      <div style={{ position: "relative", zIndex: 1, padding: "32px 3% 0", maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Agent Economy Insights</div>
        <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>Analytics</h1>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: C.steel, maxWidth: 480 }}>
          Real-time metrics, volume trends, and transaction history across the agent economy.
        </p>
        <div style={{ height: 1, background: "rgba(11,26,51,0.1)", marginTop: 28 }} />
      </div>

      {stats && (
        <div style={{ position: "relative", zIndex: 1, padding: "24px 3% 48px", maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          
          {/* KEY METRICS ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { icon: DollarSign, color: C.mint, label: "Total Volume", value: fmt(stats.totalVolume), unit: "USDC", trend: "+12.5%", up: true },
              { icon: Activity, color: C.ocean, label: "Transactions", value: stats.totalPayments, unit: "total", trend: "+8.2%", up: true },
              { icon: Zap, color: C.purple, label: "Average", value: fmt(stats.averageAmount), unit: "USDC/txn", trend: "-3.1%", up: false },
              { icon: Bot, color: C.gold, label: "Active Agents", value: 3, unit: "online", trend: "+2", up: true },
            ].map((m) => (
              <div key={m.label} style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</span>
                  <m.icon size={18} color={m.color} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.ink, marginBottom: 6, letterSpacing: "-0.04em" }}>{m.value}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: C.steel }}>{m.unit}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 800, color: m.up ? C.mint : C.coral }}>
                    {m.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {m.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* TWO COLUMNS: CHART + TOP EARNERS */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* VOLUME CHART */}
            <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)", padding: 24 }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em" }}>Daily Volume — USDC</h3>
              <div style={{ height: 220, display: "flex", alignItems: "end", gap: 10, paddingBottom: 28, position: "relative" }}>
                {stats.dailyVolume.map((day, i) => (
                  <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ 
                      width: "100%", borderRadius: "4px 4px 0 0",
                      background: `linear-gradient(to top, ${C.purple}, ${C.surf})`,
                      height: Math.max(6, (day.volume / maxVol) * 180),
                      position: "relative", cursor: "pointer", transition: "filter 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.85)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}>
                      {/* Tooltip */}
                      <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: C.purple, whiteSpace: "nowrap" }}>
                        {fmt(day.volume)}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: C.steel, textAlign: "center", fontWeight: 600 }}>
                      {mounted ? new Date(day.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }) : day.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP EARNERS */}
            <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)", padding: 24 }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em" }}>Top Earners</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {stats.topEarners.map((earner, i) => (
                  <div key={earner.agentId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: [C.gold, C.surf, C.coral, C.steel, C.steel][i] || C.steel, display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{earner.agentId}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, color: C.mint, flexShrink: 0 }}>{fmt(earner.earned)} USDC</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVITY TABLE WITH PAGINATION */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(11,26,51,0.08)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em" }}>Transaction History</h3>
            </div>

            {/* Table Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 16, padding: "10px 24px", background: "rgba(11,26,51,0.02)", fontSize: 10, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <div>Agent</div>
              <div>Service</div>
              <div>Amount</div>
              <div>Time</div>
              <div>Type</div>
            </div>

            {/* Table Body */}
            {pageActivity.map((tx) => (
              <div key={tx.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 16, padding: "12px 24px", borderTop: "1px solid rgba(11,26,51,0.05)", alignItems: "center", fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.agentId}</div>
                <div style={{ color: C.steel, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.service}</div>
                <div style={{ fontWeight: 800, color: tx.type === "earned" ? C.mint : C.coral }}>
                  {tx.type === "earned" ? "+" : "-"}{fmt(tx.amount)} USDC
                </div>
                <div style={{ color: C.steel, whiteSpace: "nowrap" }}>
                  {mounted ? `${new Date(tx.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${new Date(tx.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : tx.timestamp}
                </div>
                <div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", background: tx.type === "earned" ? "rgba(90,205,167,0.12)" : "rgba(255,75,49,0.12)", color: tx.type === "earned" ? C.mint : C.coral }}>
                    {tx.type === "earned" ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                    {tx.type}
                  </span>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid rgba(11,26,51,0.1)" }}>
              <div style={{ fontSize: 11, color: C.steel }}>
                Page <strong style={{ color: C.ink }}>{page}</strong> of {totalPages} · Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, activity.length)} of {activity.length}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, background: "white", color: page === 1 ? "rgba(11,26,51,0.3)" : C.ink, fontSize: 11, fontWeight: 700, cursor: page === 1 ? "not-allowed" : "pointer" }}>
                  <ChevronLeft size={12} /> Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = page <= 3 ? 1 : page >= totalPages - 2 ? totalPages - 4 : page - 2;
                  const n = start + i;
                  if (n < 1 || n > totalPages) return null;
                  return (
                    <button key={n} onClick={() => setPage(n)}
                      style={{ width: 34, height: 34, border: "1px solid", borderColor: n === page ? C.ink : "rgba(11,26,51,0.15)", borderRadius: 6, background: n === page ? C.ink : "white", color: n === page ? "white" : C.ink, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                      {n}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, background: "white", color: page === totalPages ? "rgba(11,26,51,0.3)" : C.ink, fontSize: 11, fontWeight: 700, cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(11,26,51,0.08)", padding: "20px 3%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: C.steel }}>
        <span>© 2026 ArcGent — Agentic Economy on Arc</span>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/dashboard" style={{ color: C.steel, textDecoration: "none" }}>Dashboard</Link>
          <Link href="/marketplace" style={{ color: C.steel, textDecoration: "none" }}>Marketplace</Link>
          <Link href="/onboarding" style={{ color: C.steel, textDecoration: "none" }}>Onboarding</Link>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        ::selection{background:rgba(172,198,233,.4)}
      `}} />
    </div>
  );
}