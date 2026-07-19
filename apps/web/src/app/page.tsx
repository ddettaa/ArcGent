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
const FL = (c?: string): React.CSSProperties => ({
  display: "inline-flex", gap: 8, alignItems: "center", paddingBottom: 2,
  borderBottom: "1px solid currentColor", fontSize: 8, fontWeight: 900,
  letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none", color: c || "inherit",
});

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
      {/* DOT BACKGROUND OVERLAY */}
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
          {["How It Works","Use Cases","Process","Agent Log"].map((l,i) => (
            <span key={l} onClick={() => document.getElementById(["hw","uc","pr","al"][i])?.scrollIntoView({behavior:"smooth"})} style={{ cursor:"pointer" }}>{l}</span>
          ))}
        </nav>
        <Link href="/dashboard" style={{ padding:"11px 15px", color:"white", background:C.coral, fontSize:8, fontWeight:900, textTransform:"uppercase", textDecoration:"none", borderRadius:3 }}>
          Launch Agent ↗
        </Link>
      </header>

      {/* HERO — full viewport */}
      <section style={{ position:"relative", minHeight:"calc(100vh - 60px)", padding:`120px ${px} 60px`, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"center" }}>
        <h1 style={{ position:"relative", zIndex:3, maxWidth:800, margin:0, fontSize:"clamp(42px, 7vw, 96px)", fontWeight:900, letterSpacing:"-0.07em", lineHeight:0.83 }}>
          When signals fire,<br/>payments flow.
        </h1>
        <div style={{ position:"relative", zIndex:3, maxWidth:320, fontSize:13, lineHeight:1.3, marginTop:24, color:C.ink }}>
          Autonomous agent yang menghubungkan real-world signals ke USDC payments via Arc &amp; Circle.
          <div style={{ marginTop:14 }}><Link href="/dashboard" style={FL(C.ocean)}>Start Building ↗</Link></div>
        </div>
        <svg style={{ position:"absolute", right:px, bottom:40, zIndex:2, width:"45%", maxWidth:600, minWidth:300 }} viewBox="0 0 650 430" fill="none" aria-hidden="true">
          {[[C.ocean,"M20 432C52 341 123 303 236 259C330 223 358 185 373 116C381 79 404 59 444 59H550"],
            [C.mint,"M45 435C75 352 139 319 250 277C350 239 381 196 391 137C397 100 420 81 461 81H560"],
            [C.gold,"M72 438C101 365 155 337 269 295C368 258 400 216 409 158C415 123 438 104 477 104H570"],
            [C.coral,"M99 441C126 379 175 354 286 313C386 276 421 236 428 180C433 146 455 128 493 128H580"],
            [C.purple,"M126 444C151 394 194 372 304 332C405 295 440 257 446 202C450 169 472 153 509 153H590"]].map(([c,d],i)=><path key={i} d={d as string} stroke={c as string} strokeWidth="14" strokeLinecap="round"/>)}
          {[[C.ocean,[[565,59,6],[584,59,7],[605,59,8],[629,59,10]]],[C.mint,[[575,81,5],[593,81,6],[613,81,7],[635,81,9]]],[C.gold,[[584,104,5],[601,104,6],[620,104,7],[641,104,8]]]].map(([c,pts],i)=><g key={i} fill={c as string}>{(pts as number[][]).map(([cx,cy,r],j)=><circle key={j} cx={cx} cy={cy} r={r}/>)}</g>)}
        </svg>
      </section>

      {/* MANIFESTO — full width foam */}
      <section style={{ position:"relative", padding:`60px ${px}`, background:C.foam, borderTop:"1px solid rgba(11,26,51,0.15)", borderBottom:"1px solid rgba(11,26,51,0.15)" }}>
        <div style={K}>Our Thesis</div>
        <h2 style={{ maxWidth:900, margin:"16px 0 28px", fontSize:"clamp(32px, 5vw, 56px)", lineHeight:0.86, letterSpacing:"-0.055em" }}>
          Agents don't need permission to <em style={{ fontFamily:"Georgia, serif", fontWeight:400, fontStyle:"italic" }}>transact.</em>
        </h2>
        <p style={{ maxWidth:480, margin:0, fontSize:13, lineHeight:1.35, color:C.ocean }}>
          ArcGent listens to onchain &amp; offchain signals — merges, bug fixes, API pings — then autonomously routes USDC payments through Circle wallets. No humans in the loop.
        </p>
        <div style={{ marginTop:20 }}><Link href="/dashboard" style={FL(C.steel)}>Read the protocol ↗</Link></div>
        {/* Flight path + signal dots */}
        <div style={{ position:"absolute", right:px, bottom:40, width:"40%", maxWidth:500, height:150, pointerEvents:"none" }} aria-hidden="true">
          <svg style={{ width:"100%", height:"100%" }} viewBox="0 0 500 150" fill="none"><path d="M4 130C85 93 57 60 142 66C218 71 170 14 253 13C347 11 338 101 484 84" stroke={C.ocean} strokeWidth="1.5" strokeDasharray="5 5" opacity="0.65"/></svg>
          {[{t:15,r:60,w:18,bg:C.ocean,a:"2s"},{t:55,l:80,w:12,bg:C.coral,a:"2.5s .5s"},{r:80,b:15,w:14,bg:C.mint,a:"3s 1s"},{l:120,b:25,w:10,bg:C.gold,a:"2.8s .7s"},{t:25,r:140,w:8,bg:C.purple,a:"2.2s 1.4s"}].map((d,i)=><span key={i} style={{position:"absolute",borderRadius:"50%",top:d.t,right:d.r,left:d.l as any,bottom:d.b as any,width:d.w,height:d.w,background:d.bg,animation:`signalPulse ${d.a} infinite`}}/>)}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="hw" style={{ padding:`50px ${px} 30px`, background:"color-mix(in srgb, #f4f0e6 96%, white)" }}>
        <div style={{...K, marginBottom:16}}>How ArcGent works</div>
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          {[
            { n:"01", c:C.ocean, t:"Listen", d:"Agent monitors verified signal sources — GitHub events, onchain oracles, flight data, Strava APIs, weather feeds — any structured event stream.", l:"Explore signals" },
            { n:"02", c:C.coral, t:"Decide", d:"LLM-powered decision engine evaluates trigger conditions against user-defined rules. \"If PR merged + label 'bugfix' → pay 50 USDC.\"", l:"Explore rules" },
            { n:"03", c:C.mint, t:"Pay", d:"Circle Agent Stack executes the payment — wallet debit, USDC transfer, settlement confirmed onchain. Nanopayments for sub-cent amounts.", l:"Explore payments" },
          ].map((r,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr", gap:24, alignItems:"center", minHeight:100, borderBottom:`1px solid rgba(11,26,51,0.4)`, paddingBlock:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <span style={{ fontSize:20, fontWeight:900, color:r.c }}>{r.n}</span>
                <h3 style={{ margin:0, fontSize:"clamp(28px,5vw,60px)", letterSpacing:"-0.06em", lineHeight:0.88 }}>{r.t}</h3>
              </div>
              <div style={{
                height:60, opacity:0.85,
                backgroundImage:`radial-gradient(circle, ${r.c} 2.1px, transparent 2.4px)`,
                backgroundSize:"13px 13px",
                maskImage: i===0 ? "linear-gradient(90deg, transparent, black 22%, black 72%, transparent)" : i===1 ? "radial-gradient(ellipse at 35% 50%, black 8%, transparent 70%)" : "linear-gradient(110deg, transparent 3%, black 35%, transparent 91%)",
                ...(i===2?{transform:"skewX(-18deg)"}:{}),
              }}/>
              <p style={{ margin:0, fontSize:11, lineHeight:1.4, color:r.c }}>
                {r.d}<br/>
                <span style={{ display:"block", marginTop:8 }}><Link href="/dashboard" style={FL(r.c)}>{r.l} ↗</Link></span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* USE CASES */}
      <section id="uc" style={{ padding:`40px ${px} 30px` }}>
        <div style={{...K, marginBottom:12}}>Use Cases</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16 }}>
          {[
            { t:"Bug Bounty", d:"Auto-pay developers when their PR with \"fix:\" label gets merged. No manual approval.", bg:"rgba(244,240,230,0.86)", cl:C.ocean, art:"wave" },
            { t:"Refund AI", d:"Flight delayed > 2 hours? API ping triggers instant USDC refund to traveler's wallet.", bg:C.coral, cl:"white", art:"node" },
            { t:"Tip Stream", d:"Content hits 1000 reads? Writer gets tipped automatically via Circle Nanopayments.", bg:"rgba(244,240,230,0.86)", cl:C.mint, art:"ripple" },
            { t:"Accountability", d:"Missed gym all week? Your Strava data triggers a penalty payment to your accountability partner.", bg:C.purple, cl:"white", art:"arc" },
          ].map((c,i) => (
            <article key={i} style={{ position:"relative", minHeight:280, padding:16, overflow:"hidden", border:"1px solid rgba(11,26,51,0.15)", background:c.bg, color:c.cl }}>
              <h4 style={{ position:"relative", zIndex:2, margin:0, fontSize:32, letterSpacing:"-0.04em", fontWeight:900, color:c.cl==="white"?"white":c.cl }}>{c.t}</h4>
              <p style={{ position:"relative", zIndex:2, maxWidth:200, marginTop:6, fontSize:10, lineHeight:1.35 }}>{c.d}</p>
              {c.art==="wave" && <div style={{ position:"absolute", left:-15, right:-15, bottom:40, height:92, backgroundImage:`radial-gradient(circle, ${C.ocean} 1.55px, transparent 1.8px)`, backgroundSize:"7px 7px", clipPath:"polygon(0 58%, 14% 36%, 29% 18%, 46% 28%, 61% 62%, 75% 45%, 89% 58%, 100% 38%, 100% 100%, 0 100%)" }}/>}
              {c.art==="node" && <div style={{ position:"absolute", left:24, bottom:25, width:128, height:128, border:`27px solid ${C.sand}`, borderRadius:"50%" }}><div style={{ position:"absolute", left:32, top:32, width:22, height:22, borderRadius:"50%", background:C.ink }}/></div>}
              {c.art==="ripple" && <div style={{ position:"absolute", right:-12, bottom:25, width:150, height:125, border:`8px double ${C.mint}`, borderRadius:"49% 51% 46% 54%", transform:"rotate(-8deg)", opacity:0.9, boxShadow:`inset 0 0 0 8px ${C.sand}, inset 0 0 0 14px ${C.mint}, inset 0 0 0 21px ${C.sand}, inset 0 0 0 27px ${C.mint}` }}/>}
              {c.art==="arc" && <div style={{ position:"absolute", right:-20, bottom:-55, width:165, height:165, border:`31px solid ${C.ink}`, borderRadius:"50%" }}><div style={{ position:"absolute", inset:23, border:`14px solid ${C.sand}`, borderRadius:"50%" }}/></div>}
              <Link href="/dashboard" style={{...FL(c.cl), position:"absolute", left:16, bottom:12, zIndex:3, fontSize:7 }}>View case ↗</Link>
            </article>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
          <Link href="/dashboard" style={FL(C.ink)}>All use cases ↗</Link>
        </div>
      </section>

      {/* PROCESS */}
      <section id="pr" style={{ padding:`0 ${px} 40px` }}>
        <div style={{...K, marginBottom:16}}>Agent Lifecycle</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:0 }}>
          {[
            { t:"Connect", d:"Wire your signal source via API, webhook, or oracle feed.", c:C.ocean },
            { t:"Configure", d:"Define rules: IF {condition} THEN pay {amount} USDC to {wallet}.", c:C.coral },
            { t:"Verify", d:"Agent validates signal authenticity before triggering payment.", c:C.mint },
            { t:"Settle", d:"USDC transfer executed onchain. Receipt logged. Balance updated.", c:C.purple },
          ].map((s,i) => (
            <div key={i} style={{ position:"relative", minHeight:110, padding:"20px 20px 14px", borderTop:`4px solid ${s.c}` }}>
              <div style={{ position:"absolute", top:-8, left:0, width:12, height:12, border:`2px solid ${C.sand}`, borderRadius:"50%", background:s.c }}/>
              <strong style={{ display:"block", marginBottom:4, fontSize:15 }}>{s.t}</strong>
              <span style={{ display:"block", maxWidth:220, fontSize:10, lineHeight:1.35, color:C.steel }}>{s.d}</span>
              <div style={{ marginTop:10 }}><Link href="/dashboard" style={{...FL(C.ink), fontSize:7}}>Learn ↗</Link></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ display:"grid", gridTemplateColumns:"1fr 1fr", minHeight:300, background:C.ocean, color:"white", borderBlock:"1px solid rgba(11,26,51,0.15)" }}>
        <div style={{ padding:`50px ${px}`, display:"flex", flexDirection:"column", justifyContent:"center" }}>
          <div style={K}>Agent-First Economy</div>
          <h2 style={{ maxWidth:500, margin:"16px 0 20px", fontSize:"clamp(28px, 4vw, 52px)", lineHeight:0.85, letterSpacing:"-0.06em" }}>Your agent holds the wallet. Your rules move the money.</h2>
          <p style={{ maxWidth:360, fontSize:10, lineHeight:1.35, opacity:0.85 }}>ArcGent runs on Circle Agent Stack. Every agent gets its own wallet. Every rule is auditable. Every payment is instant.</p>
          <div style={{ marginTop:18 }}><Link href="/dashboard" style={FL(C.surf)}>Deploy your first agent ↗</Link></div>
        </div>
        <div style={{ position:"relative", minHeight:300 }} aria-hidden="true">
          {[{s:340,c:C.sand},{s:278,c:C.surf},{s:216,c:C.mint},{s:154,c:C.purple},{s:92,c:C.gold}].map((r,i)=><i key={i} style={{position:"absolute",left:"50%",top:"50%",borderRadius:"50%",transform:"translate(-50%,-50%)",width:r.s,height:r.s,border:`17px solid ${r.c}`,background:i===4?C.sand:"transparent"}}/>)}
          <span style={{position:"absolute",zIndex:4,left:"50%",top:"50%",width:94,transform:"translate(-50%,-50%) rotate(-3deg)",textAlign:"center",fontFamily:"monospace",fontSize:8,fontWeight:700,color:C.ink}}>SIGNAL IN.<br/>USDC OUT.</span>
        </div>
      </section>

      {/* AGENT LOG */}
      <section id="al" style={{ padding:`40px ${px}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={K}>Agent Log</div>
          <Link href="/dashboard" style={FL(C.ink)}>View all ↗</Link>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16, marginTop:16 }}>
          {[
            { tag:"Protocol", title:"How SignalPay agents verify offchain events", art:"ocean" as const, lc:C.ocean },
            { tag:"Engineering", title:"Building agent wallets on Circle Agent Stack", art:"stripes" as const, lc:C.coral },
            { tag:"Use Case", title:"The rise of nanopayments in agent economies", art:"mint" as const, lc:C.mint },
            { tag:"Research", title:"Agent-to-agent negotiation: a new primitive", art:"purple" as const, lc:C.purple },
          ].map((n,i) => (
            <article key={i} style={{ minHeight:180, padding:10, border:"1px solid rgba(11,26,51,0.12)", background:"rgba(244,240,230,0.72)" }}>
              <div style={{
                height:80, marginBottom:10,
                ...(n.art==="ocean" ? { backgroundImage:`radial-gradient(circle, ${C.ocean} 1.6px, transparent 1.9px)`, backgroundSize:"8px 8px", maskImage:"radial-gradient(ellipse, black 8%, transparent 72%)", WebkitMaskImage:"radial-gradient(ellipse, black 8%, transparent 72%)" } : n.art==="mint" ? { backgroundImage:`radial-gradient(circle, ${C.mint} 1.6px, transparent 1.9px)`, backgroundSize:"8px 8px", maskImage:"linear-gradient(90deg, transparent, black 35%, black 65%, transparent)", WebkitMaskImage:"linear-gradient(90deg, transparent, black 35%, black 65%, transparent)" } : n.art==="purple" ? { backgroundImage:`radial-gradient(circle, ${C.purple} 1.6px, transparent 1.9px)`, backgroundSize:"8px 8px", maskImage:"radial-gradient(ellipse at 50% 105%, black 10%, transparent 68%)", WebkitMaskImage:"radial-gradient(ellipse at 50% 105%, black 10%, transparent 68%)" } : { background:`repeating-linear-gradient(135deg, ${C.mint} 0 8px, ${C.sand} 8px 13px, ${C.gold} 13px 21px, ${C.sand} 21px 26px, ${C.coral} 26px 34px, ${C.sand} 34px 39px, ${C.ocean} 39px 47px, ${C.sand} 47px 52px)` }),
              }}/>
              <time style={{ fontSize:6, textTransform:"uppercase", color:C.steel }}>{n.tag}</time>
              <h4 style={{ margin:"6px 0 14px", fontSize:11, lineHeight:1.2, fontWeight:700 }}>{n.title}</h4>
              <Link href="/dashboard" style={{...FL(n.lc), fontSize:6}}>Read ↗</Link>
            </article>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section style={{ padding:`50px ${px}`, borderTop:"1px solid rgba(11,26,51,0.2)" }}>
        <h2 style={{ maxWidth:900, margin:0, fontSize:"clamp(32px, 5vw, 56px)", lineHeight:0.85, letterSpacing:"-0.06em" }}>
          What signal will <em style={{ fontFamily:"Georgia, serif", fontWeight:400 }}>your agent</em> listen for?
        </h2>
        <p style={{ fontSize:12, lineHeight:1.4, color:C.steel, marginTop:16, maxWidth:400 }}>
          From bug bounties to flight refunds — if it can be verified, it can be paid.
        </p>
        <div style={{ marginTop:16 }}><Link href="/dashboard" style={FL(C.ocean)}>Launch agent ↗</Link></div>
      </section>

      {/* FOOTER */}
      <footer style={{ display:"flex", flexWrap:"wrap", gap:40, justifyContent:"space-between", padding:`20px ${px} 30px`, borderTop:"1px solid rgba(11,26,51,0.2)", fontSize:10, color:C.steel }}>
        <strong style={{ fontSize:15, letterSpacing:"-0.04em", color:C.ink }}>ArcGent</strong>
        <span>Signal-to-payment<br/>autonomous agents.</span>
        <span>LISTEN<br/>DECIDE<br/>PAY</span>
        <span>DOCS<br/>GITHUB<br/>DISCORD</span>
        <span>Built on Arc &amp; Circle<br/>Agent Stack<br/>© 2026</span>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes signalPulse { 0%,100%{transform:scale(1);opacity:.8;} 50%{transform:scale(2.5);opacity:.15;} }
        ::selection { background: rgba(172,198,233,0.4); }
      `}}/>
    </div>
  );
}
