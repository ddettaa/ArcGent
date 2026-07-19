"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", surf: "#acc6e9", coral: "#ff4b31",
  mint: "#5acda7", gold: "#f2a43a", purple: "#9f72ff",
  foam: "#d6f0e8", deep: "#060f1f",
};

const K: React.CSSProperties = { fontSize: 8, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const px = "3%";

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans', 'Inter', sans-serif", color: C.ink }}>
      {/* DOT OVERLAY */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(11,26,51,0.06) 0.7px, transparent 0.7px)",
        backgroundSize: "16px 16px",
      }}/>

      {/* NAV */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 30, minHeight: 60, padding: `0 ${px}`,
        background: scrolled ? "rgba(244,240,230,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `1px solid rgba(11,26,51,0.08)`,
        transition: "all 0.3s",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 900, letterSpacing: "-0.05em", color: C.ink, textDecoration: "none" }}>
          <span style={{ display: "grid", placeItems: "center", width: 33, height: 33, color: "white", background: C.ocean, fontSize: 11, letterSpacing: "-0.08em", borderRadius: 4 }}>AG</span>
          ArcGent
        </Link>
        <nav style={{ display: "flex", gap: 28, fontSize: 8, fontWeight: 700, color: C.steel }}>
          {["How It Works","Use Cases","Try It"].map((l,i) => (
            <span key={l} onClick={() => document.getElementById(["hw","uc","try"][i])?.scrollIntoView({behavior:"smooth"})} style={{ cursor:"pointer" }}>{l}</span>
          ))}
        </nav>
        <Link href="/dashboard" style={{ padding:"11px 15px", color:"white", background:C.coral, fontSize:8, fontWeight:900, textTransform:"uppercase", textDecoration:"none", borderRadius:3 }}>
          Launch Agent ↗
        </Link>
      </header>

      {/* HERO — What is ArcGent in 10 seconds */}
      <section style={{ position:"relative", minHeight:"calc(100vh - 60px)", padding:`120px ${px} 60px`, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"center" }}>
        <h1 style={{ position:"relative", zIndex:3, maxWidth:900, margin:0, fontSize:"clamp(42px, 7vw, 96px)", fontWeight:900, letterSpacing:"-0.07em", lineHeight:0.83 }}>
          If This,<br/>Then Pay.
        </h1>
        <div style={{ position:"relative", zIndex:3, maxWidth:400, fontSize:14, lineHeight:1.5, marginTop:28, color:C.ink }}>
          <p style={{ margin:0 }}>
            ArcGent is an AI agent that listens to real-world signals — 
            GitHub merges, API calls, flight delays — and <strong>automatically pays people 
            with USDC</strong> based on what the AI decides is fair.
          </p>
          <p style={{ margin:"12px 0 0", fontSize:11, color:C.steel }}>
            Not "IF/THEN" rules. AI reasoning: "This fix is critical → pay $600."
          </p>
          <div style={{ marginTop:20, display:"flex", gap:12, alignItems:"center" }}>
            <Link href="/dashboard" style={{ padding:"12px 20px", background:C.ocean, color:"white", fontSize:10, fontWeight:800, textDecoration:"none", borderRadius:3 }}>
              Try It Now
            </Link>
            <Link href="/dashboard" style={{ padding:"12px 20px", border:`1px solid ${C.ocean}`, color:C.ocean, fontSize:10, fontWeight:800, textDecoration:"none", borderRadius:3 }}>
              View Dashboard
            </Link>
          </div>
        </div>
        
        {/* Animated signal dots */}
        <svg style={{ position:"absolute", right:px, bottom:40, zIndex:2, width:"45%", maxWidth:600, minWidth:300 }} viewBox="0 0 650 430" fill="none" aria-hidden="true">
          {[[C.ocean,"M20 432C52 341 123 303 236 259C330 223 358 185 373 116C381 79 404 59 444 59H550"],
            [C.mint,"M45 435C75 352 139 319 250 277C350 239 381 196 391 137C397 100 420 81 461 81H560"],
            [C.gold,"M72 438C101 365 155 337 269 295C368 258 400 216 409 158C415 123 438 104 477 104H570"],
            [C.coral,"M99 441C126 379 175 354 286 313C386 276 421 236 428 180C433 146 455 128 493 128H580"],
            [C.purple,"M126 444C151 394 194 372 304 332C405 295 440 257 446 202C450 169 472 153 509 153H590"]].map(([c,d],i)=><path key={i} d={d as string} stroke={c as string} strokeWidth="14" strokeLinecap="round"/>)}
          {[[C.ocean,[[565,59,6],[584,59,7],[605,59,8],[629,59,10]]],[C.mint,[[575,81,5],[593,81,6],[613,81,7],[635,81,9]]],[C.gold,[[584,104,5],[601,104,6],[620,104,7],[641,104,8]]]].map(([c,pts],i)=><g key={i} fill={c as string}>{(pts as number[][]).map(([cx,cy,r],j)=><circle key={j} cx={cx} cy={cy} r={r}/>)}</g>)}
        </svg>
      </section>

      {/* WHAT IT DOES — 3 steps with real examples */}
      <section style={{ position:"relative", padding:`60px ${px}`, background:C.foam, borderTop:"1px solid rgba(11,26,51,0.15)", borderBottom:"1px solid rgba(11,26,51,0.15)" }}>
        <div style={K}>What it actually does</div>
        <h2 style={{ maxWidth:900, margin:"16px 0 40px", fontSize:"clamp(32px, 5vw, 56px)", lineHeight:0.86, letterSpacing:"-0.055em" }}>
          Signal → AI Decision → USDC Payment
        </h2>
        
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:24 }}>
          {[
            { 
              icon:"🎯", 
              title:"Signal Fires", 
              desc:"PR merged on GitHub. API endpoint hit. Flight delayed. Webhook received.",
              example:"\"PR #42 merged with label 'security'\""
            },
            { 
              icon:"🧠", 
              title:"AI Evaluates", 
              desc:"LLM reads the context, evaluates severity, and decides how much to pay.",
              example:"\"Critical reentrancy fix, trusted contributor → 600 USDC\""
            },
            { 
              icon:"💰", 
              title:"Payment Sent", 
              desc:"USDC transferred instantly via Circle Agent Stack on Arc Testnet.",
              example:"\"600 USDC sent to 0x3695...a556. Confirmed on-chain.\""
            },
          ].map((s,i) => (
            <div key={i} style={{ background:"white", padding:24, borderRadius:8, border:`1px solid rgba(11,26,51,0.1)` }}>
              <div style={{ fontSize:24, marginBottom:12 }}>{s.icon}</div>
              <h3 style={{ margin:"0 0 8px", fontSize:18, fontWeight:800 }}>{s.title}</h3>
              <p style={{ margin:"0 0 12px", fontSize:12, lineHeight:1.5, color:C.steel }}>{s.desc}</p>
              <div style={{ padding:"8px 12px", background:C.foam, borderRadius:4, fontSize:11, fontFamily:"monospace", color:C.ink }}>
                {s.example}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REAL EXAMPLE — Show actual AI decision */}
      <section style={{ padding:`60px ${px}`, background:"white", borderBottom:`1px solid rgba(11,26,51,0.15)` }}>
        <div style={K}>Real Example</div>
        <h2 style={{ maxWidth:800, margin:"16px 0 40px", fontSize:"clamp(28px, 4vw, 48px)", lineHeight:0.86, letterSpacing:"-0.055em" }}>
          This is what ArcGent actually decided:
        </h2>
        
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(350px, 1fr))", gap:24 }}>
          {[
            {
              scenario:"Critical Security Fix",
              input:"PR: Fix reentrancy in Vault.withdraw() — could drain $500k",
              aiReasoning:"Critical severity, trusted contributor with 8+ PRs, security label detected. Base critical reward: $500. Contributor bonus: +20%.",
              decision:"APPROVED",
              amount:"600 USDC",
              confidence:"95%",
              severity:"CRITICAL",
              color:C.coral
            },
            {
              scenario:"Typo Fix",
              input:"PR: Fix typo 'teh' → 'the' in README.md",
              aiReasoning:"Low severity documentation change. First-time contributor bonus applied. Standard minor reward.",
              decision:"APPROVED", 
              amount:"11 USDC",
              confidence:"95%",
              severity:"LOW",
              color:C.mint
            },
            {
              scenario:"Content Quality",
              input:"Blog post: 3000-word DeFi guide with original diagrams",
              aiReasoning:"Original research, high word count, includes custom visuals. Qualifies for premium content reward with media bonus.",
              decision:"APPROVED",
              amount:"160 USDC",
              confidence:"95%", 
              severity:"HIGH",
              color:C.purple
            },
          ].map((e,i) => (
            <div key={i} style={{ padding:24, background:C.sand, borderRadius:8, border:`1px solid rgba(11,26,51,0.1)` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{e.scenario}</h3>
                <span style={{ padding:"4px 8px", background:e.color, color:"white", fontSize:8, fontWeight:800, borderRadius:3 }}>
                  {e.severity}
                </span>
              </div>
              
              <div style={{ fontSize:11, color:C.steel, marginBottom:12, fontStyle:"italic" }}>
                {e.input}
              </div>
              
              <div style={{ padding:12, background:"white", borderRadius:6, marginBottom:12, fontSize:11, lineHeight:1.4 }}>
                <strong style={{ color:C.purple }}>AI Reasoning:</strong><br/>
                {e.aiReasoning}
              </div>
              
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:900, color:e.decision==="APPROVED"?C.mint:C.coral }}>
                    {e.decision}
                  </div>
                  <div style={{ fontSize:24, fontWeight:900, color:C.purple }}>{e.amount}</div>
                </div>
                <div style={{ fontSize:10, color:C.steel, textAlign:"right" }}>
                  Confidence<br/>
                  <strong style={{ fontSize:16, color:C.ink }}>{e.confidence}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop:24, padding:16, background:C.foam, borderRadius:6, fontSize:12, textAlign:"center" }}>
          <strong>These are real decisions made by ArcGent's AI.</strong> Not demos. Not mock data.
          <br/>
          <Link href="/dashboard" style={{ color:C.ocean, textDecoration:"underline", fontWeight:700 }}>Try it yourself →</Link>
        </div>
      </section>

      {/* HOW IT WORKS — Simple */}
      <section id="hw" style={{ padding:`60px ${px}`, background:"color-mix(in srgb, #f4f0e6 96%, white)" }}>
        <div style={K}>How to use it</div>
        <div style={{ display:"flex", flexDirection:"column", gap:0, marginTop:16 }}>
          {[
            { n:"01", c:C.ocean, t:"Pick a Template", d:"Choose from pre-built scenarios: Bug Bounty, Refund AI, Content Tipping, etc." },
            { n:"02", c:C.coral, t:"Set Your Rules", d:"Tell the agent what to listen for and roughly how much to pay." },
            { n:"03", c:C.mint, t:"AI Does the Rest", d:"Agent monitors signals, evaluates context, and pays automatically." },
          ].map((r,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 2fr", gap:24, alignItems:"center", minHeight:80, borderBottom:`1px solid rgba(11,26,51,0.2)`, paddingBlock:20 }}>
              <div style={{ fontSize:24, fontWeight:900, color:r.c }}>{r.n}</div>
              <h3 style={{ margin:0, fontSize:"clamp(24px,4vw,40px)", letterSpacing:"-0.06em", lineHeight:0.88 }}>{r.t}</h3>
              <p style={{ margin:0, fontSize:12, lineHeight:1.4, color:C.steel }}>{r.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USE CASES — Real scenarios */}
      <section id="uc" style={{ padding:`60px ${px}` }}>
        <div style={K}>Use Cases</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20, marginTop:16 }}>
          {[
            { t:"🐛 Bug Bounty", d:"Pay developers automatically when their security fixes get merged. AI evaluates severity.", tag:"Auto-pay on merge", bg:C.ocean, cl:"white" },
            { t:"✈️ Refund AI", d:"Flight delayed? API triggers instant USDC refund to traveler's wallet. No forms.", tag:"Instant refund", bg:C.coral, cl:"white" },
            { t:"✍️ Content Tips", d:"Blog post hits quality threshold? Writer gets tipped automatically based on AI evaluation.", tag:"Quality-based", bg:C.mint, cl:C.ink },
            { t:"💪 Accountability", d:"Missed gym all week? Your Strava data triggers a penalty payment to your friend.", tag:"Self-enforcement", bg:C.purple, cl:"white" },
            { t:"🎯 API Rewards", d:"User completes onboarding? API call triggers welcome bonus in USDC.", tag:"Growth incentive", bg:C.gold, cl:C.ink },
            { t:"🔧 DevOps Bounty", d:"Server downtime detected? Auto-pay the on-call engineer who fixes it first.", tag:"Incident response", bg:C.steel, cl:"white" },
          ].map((c,i) => (
            <div key={i} style={{ minHeight:200, padding:20, background:c.bg, color:c.cl, borderRadius:8, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
              <div>
                <h4 style={{ margin:"0 0 8px", fontSize:20, fontWeight:900 }}>{c.t}</h4>
                <p style={{ margin:0, fontSize:11, lineHeight:1.4, opacity:0.9 }}>{c.d}</p>
              </div>
              <div style={{ fontSize:8, fontWeight:800, textTransform:"uppercase", opacity:0.8 }}>{c.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TECH STACK */}
      <section style={{ padding:`40px ${px}`, background:C.foam, borderTop:`1px solid rgba(11,26,51,0.15)` }}>
        <div style={K}>Built on</div>
        <div style={{ display:"flex", gap:40, marginTop:16, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900 }}>Arc Network</div>
            <div style={{ fontSize:10, color:C.steel }}>USDC-native gas</div>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:900 }}>Circle Agent Stack</div>
            <div style={{ fontSize:10, color:C.steel }}>Wallet + payments</div>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:900 }}>9Router LLM</div>
            <div style={{ fontSize:10, color:C.steel }}>AI decision engine</div>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:900 }}>Real USDC</div>
            <div style={{ fontSize:10, color:C.steel }}>On-chain settlement</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="try" style={{ padding:`80px ${px}`, textAlign:"center", background:C.ocean, color:"white" }}>
        <h2 style={{ maxWidth:700, margin:"0 auto 20px", fontSize:"clamp(32px, 5vw, 56px)", lineHeight:0.85, letterSpacing:"-0.06em" }}>
          Stop thinking about it.<br/>Start paying automatically.
        </h2>
        <p style={{ maxWidth:400, margin:"0 auto 32px", fontSize:12, lineHeight:1.4, opacity:0.9 }}>
          Connect your wallet, pick a template, and let the AI agent handle payments while you sleep.
        </p>
        <Link href="/dashboard" style={{ display:"inline-block", padding:"16px 32px", background:C.coral, color:"white", fontSize:12, fontWeight:900, textDecoration:"none", borderRadius:3, textTransform:"uppercase" }}>
          Launch ArcGent
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ display:"flex", flexWrap:"wrap", gap:40, justifyContent:"space-between", padding:`20px ${px} 30px`, borderTop:"1px solid rgba(11,26,51,0.2)", fontSize:10, color:C.steel }}>
        <strong style={{ fontSize:15, letterSpacing:"-0.04em", color:C.ink }}>ArcGent</strong>
        <span>Signal-to-payment<br/>autonomous agents</span>
        <span>Built on Arc & Circle<br/>Agent Stack © 2026</span>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes signalPulse { 0%,100%{transform:scale(1);opacity:.8;} 50%{transform:scale(2.5);opacity:.15;} }
        ::selection { background: rgba(172,198,233,0.4); }
      `}}/>
    </div>
  );
}