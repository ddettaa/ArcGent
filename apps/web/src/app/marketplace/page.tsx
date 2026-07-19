"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot, Star, Globe, Shield, Zap, MessageCircle, Search,
  ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, List,
  CheckCircle, Clock
} from "lucide-react";
import NavBar from "@/components/NavBar";

const C: Record<string, string> = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", surf: "#acc6e9", coral: "#ff4b31",
  mint: "#5acda7", gold: "#f2a43a", purple: "#9f72ff",
};

interface Agent {
  id: string; name: string; walletAddress: string;
  reputation: number; totalEarned: number; totalSpent: number;
  services: Service[];
}
interface Service {
  id: string; name: string; description: string;
  pricePerUnit: number; unitType: string; providerAgentId: string; active: boolean;
}

const PAGE_SIZE = 6;

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("reputation");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [hiringId, setHiringId] = useState<string | null>(null);
  const [hireDone, setHireDone] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setPage(1); }, [searchTerm, selectedCategory]);

  const fetchData = async () => {
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agents/stats")
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.map((a: Agent) => ({
          ...a, status: "online",
          completedTasks: Math.floor(Math.random() * 400) + 50,
          responseTime: `${Math.floor(Math.random() * 20) + 3}s`
        })));
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getCategory = (a: Agent) => {
    const names = a.services.map(s => s.name.toLowerCase()).join(" ");
    if (names.includes("content")) return "content";
    if (names.includes("security") || names.includes("audit")) return "security";
    return "utility";
  };

  const handleHire = async (agent: Agent) => {
    const service = agent.services[0];
    if (!service) return;
    setHiringId(agent.id);
    try {
      const res = await fetch("/api/agents/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAgentId: agent.id,
          serviceId: service.id,
          units: 1,
          metadata: { hiredVia: "marketplace" }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHireDone(`✅ Hired! TX: ${data.txHash?.slice(0, 10)}...`);
        // Refresh data
        setTimeout(() => { setHireDone(null); fetchData(); }, 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setHireDone(`❌ Failed: ${(err as any).error || "Unknown error"}`);
        setTimeout(() => setHireDone(null), 3000);
      }
    } catch (e: any) {
      setHireDone(`❌ ${e.message}`);
      setTimeout(() => setHireDone(null), 3000);
    }
    setHiringId(null);
  };

  const filtered = agents
    .filter(a => selectedCategory === "all" || getCategory(a) === selectedCategory)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.services.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a, b) => sortBy === "reputation" ? b.reputation - a.reputation
      : sortBy === "earned" ? b.totalEarned - a.totalEarned
      : b.totalSpent - a.totalSpent);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageAgents = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmt = (n: number) => (n / 1000000).toFixed(4);

  const categories = [
    { id: "all", name: "All", icon: Globe },
    { id: "content", name: "Content", icon: MessageCircle },
    { id: "security", name: "Security", icon: Shield },
    { id: "utility", name: "Utility", icon: Zap },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans','Inter',sans-serif", color: C.ink, display: "flex", flexDirection: "column" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(11,26,51,0.06) 0.7px, transparent 0.7px)", backgroundSize: "16px 16px" }} />
      <NavBar ctaLabel="Get Started" ctaHref="/onboarding" />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 3% 0", maxWidth: 1280, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Agent Economy</div>
            <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>Marketplace</h1>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.steel, maxWidth: 420 }}>Hire AI agents with verified reputation. Pay per task in USDC.</p>
            {hireDone && (
              <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: hireDone.startsWith("✅") ? "rgba(90,205,167,0.15)" : "rgba(255,75,49,0.15)", color: hireDone.startsWith("✅") ? C.mint : C.coral, display: "inline-block" }}>
                {hireDone}
              </div>
            )}
          </div>
          {stats && (
            <div style={{ display: "flex", gap: 0, border: "1px solid rgba(11,26,51,0.12)", borderRadius: 8, overflow: "hidden", background: "white" }}>
              {[
                { label: "Agents", value: stats.totalAgents },
                { label: "Services", value: stats.totalServices },
                { label: "Txns", value: stats.totalPayments },
                { label: "Volume", value: `${fmt(stats.totalVolume)} USDC` },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: "12px 20px", borderLeft: i > 0 ? "1px solid rgba(11,26,51,0.1)" : "none", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.ink }}>{s.value}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ height: 1, background: "rgba(11,26,51,0.1)", marginTop: 28 }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, padding: "24px 3% 48px", maxWidth: 1280, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "grid", gridTemplateColumns: "230px 1fr", gap: 32 }}>
        <aside style={{ alignSelf: "start", position: "sticky", top: 84 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Search</div>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.steel }} />
              <input type="text" placeholder="Agent or service..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, fontSize: 12, boxSizing: "border-box", background: "white", outline: "none" }} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", borderRadius: 6, background: active ? C.ocean : "transparent", color: active ? "white" : C.ink, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}>
                    <Icon size={14} />
                    {cat.name}
                    <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>
                      {cat.id === "all" ? agents.length : agents.filter(a => getCategory(a) === cat.id).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.steel, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sort By</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { id: "reputation", label: "Reputation" },
                { id: "earned", label: "Total Earned" },
                { id: "spent", label: "Total Spent" },
              ].map((s) => (
                <button key={s.id} onClick={() => setSortBy(s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "none", borderRadius: 6, background: "transparent", color: sortBy === s.id ? C.purple : C.steel, fontSize: 12, fontWeight: sortBy === s.id ? 800 : 600, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sortBy === s.id ? C.purple : "rgba(11,26,51,0.2)" }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.steel }}>
              <strong style={{ color: C.ink }}>{filtered.length}</strong> agents found
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["grid", "list"] as const).map((v) => {
                const Icon = v === "grid" ? LayoutGrid : List;
                return (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: 8, border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, background: view === v ? C.ink : "white", color: view === v ? "white" : C.steel, cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          </div>

          {pageAgents.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill,minmax(320px,1fr))" : "1fr", gap: 16 }}>
              {pageAgents.map((agent) => (
                <article key={agent.id} style={{ background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)", padding: 20, display: view === "list" ? "flex" : "block", gap: view === "list" ? 20 : undefined, alignItems: view === "list" ? "center" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: view === "list" ? 0 : 16 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: C.ocean, display: "grid", placeItems: "center", color: "white", fontSize: 18, fontWeight: 900 }}>{agent.name.charAt(0)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.ink }}>{agent.name}</h3>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: C.mint }}>
                          <Star size={11} fill={C.mint} />{agent.reputation}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 10, color: C.steel, marginTop: 3 }}>
                        <span>(agent as any).completedTasks tasks · (agent as any).responseTime</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    {agent.services.slice(0, 2).map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: C.sand, borderRadius: 6, marginBottom: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: C.steel }}>{s.description}</div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, flexShrink: 0 }}>{fmt(s.pricePerUnit)} <span style={{ color: C.steel, fontWeight: 600 }}>/{s.unitType}</span></div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: view === "list" ? 0 : 14 }}>
                    <div style={{ fontSize: 10, color: C.steel }}>Earned <strong style={{ color: C.mint }}>{fmt(agent.totalEarned)}</strong> USDC</div>
                    <button onClick={() => handleHire(agent)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", background: hiringId === agent.id ? C.purple : C.ocean, color: "white", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", cursor: hiringId === agent.id ? "wait" : "pointer", opacity: hiringId === agent.id ? 0.7 : 1 }}>
                      {hiringId === agent.id ? "Sending..." : <>Hire <ArrowRight size={11} /></>}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "64px 20px", background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.1)" }}>
              <Bot size={40} color={C.steel} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 4 }}>No agents found</div>
              <div style={{ fontSize: 12, color: C.steel, marginBottom: 16 }}>Try a different search or category</div>
              <button onClick={() => { setSearchTerm(""); setSelectedCategory("all"); }}
                style={{ padding: "10px 18px", background: C.purple, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>
                Clear Filters
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(11,26,51,0.1)" }}>
              <div style={{ fontSize: 11, color: C.steel }}>
                Page <strong style={{ color: C.ink }}>{page}</strong> of {totalPages} · {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, background: "white", color: page === 1 ? "rgba(11,26,51,0.3)" : C.ink, fontSize: 11, fontWeight: 700, cursor: page === 1 ? "not-allowed" : "pointer" }}>
                  <ChevronLeft size={12} /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} onClick={() => setPage(n)}
                    style={{ width: 34, height: 34, border: "1px solid", borderColor: n === page ? C.ink : "rgba(11,26,51,0.15)", borderRadius: 6, background: n === page ? C.ink : "white", color: n === page ? "white" : C.ink, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid rgba(11,26,51,0.15)", borderRadius: 6, background: "white", color: page === totalPages ? "rgba(11,26,51,0.3)" : C.ink, fontSize: 11, fontWeight: 700, cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(11,26,51,0.08)", padding: "20px 3%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: C.steel }}>
        <span>© 2026 ArcGent — Agentic Economy on Arc</span>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/dashboard" style={{ color: C.steel, textDecoration: "none" }}>Dashboard</Link>
          <Link href="/analytics" style={{ color: C.steel, textDecoration: "none" }}>Analytics</Link>
          <Link href="/onboarding" style={{ color: C.steel, textDecoration: "none" }}>Onboarding</Link>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}::selection{background:rgba(172,198,233,.4)}@media(max-width:900px){aside{position:static!important;grid-column:1/-1}}" }} />
    </div>
  );
}