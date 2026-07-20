"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", surf: "#acc6e9", coral: "#ff4b31",
  mint: "#5acda7", gold: "#f2a43a", purple: "#9f72ff",
};

interface NavLink { href: string; label: string; external?: boolean; }
interface NavBarProps {
  /** Optional extra links to show besides defaults */
  extraLinks?: NavLink[];
  /** CTA button text (default: "Get Started") */
  ctaLabel?: string;
  /** CTA button href (default: "/onboarding") */
  ctaHref?: string;
  /** Show wallet connect button */
  showWallet?: boolean;
  /** Dark background variant for landing header */
  dark?: boolean;
  /** onClick handler for CTA button (replaces href) */
  ctaClick?: () => void;
}

export default function NavBar({
  extraLinks = [],
  ctaLabel = "Get Started",
  ctaHref = "/onboarding",
  showWallet = false,
  dark = false,
  ctaClick,
}: NavBarProps) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  const defaultLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/analytics", label: "Analytics" },
    { href: "/commlog", label: "A2A Log" },
  ];

  const allLinks = [...defaultLinks, ...extraLinks];

  const bg = dark ? C.ink : C.sand;
  const borderBottom = dark ? "rgba(255,255,255,0.08)" : "rgba(11,26,51,0.08)";
  const textColor = dark ? "white" : C.ink;
  const linkColor = dark ? "rgba(255,255,255,0.55)" : C.steel;
  const linkActiveColor = dark ? "white" : C.purple;
  const linkHoverColor = dark ? "white" : C.ink;

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 30, minHeight: 60, padding: "0 3%",
      background: `rgba(${dark ? "11,26,51" : "244,240,230"},0.95)`,
      backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${borderBottom}`,
      color: textColor,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 20, fontWeight: 900, letterSpacing: "-0.05em",
        color: textColor, textDecoration: "none",
        flexShrink: 0,
      }}>
        <span style={{
          display: "grid", placeItems: "center",
          width: 33, height: 33, color: "white",
          background: dark ? C.coral : C.ocean,
          fontSize: 11, letterSpacing: "-0.08em",
          borderRadius: 4,
        }}>
          AG
        </span>
        ArcGent
      </Link>

      {/* Nav Links */}
      <nav style={{ display: "flex", gap: 28, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {allLinks.map((link) => {
          const isActive = active(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              style={{
                textDecoration: "none",
                color: isActive ? linkActiveColor : linkColor,
                borderBottom: isActive ? `2px solid ${linkActiveColor}` : "2px solid transparent",
                paddingBottom: 2,
                transition: "color 0.15s, border-color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = linkHoverColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isActive ? linkActiveColor : linkColor;
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side: Wallet + CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {showWallet && <span style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: C.ocean, color: "white" }}>🔌 Wallet</span>}
        {ctaClick ? (
          <button onClick={ctaClick} style={{
            padding: "10px 16px", color: "white",
            background: dark ? C.mint : C.coral,
            fontSize: 9, fontWeight: 900, textTransform: "uppercase",
            border: "none", borderRadius: 4, cursor: "pointer",
            whiteSpace: "nowrap", transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = dark ? C.coral : C.purple; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = dark ? C.mint : C.coral; }}>
            {ctaLabel}
          </button>
        ) : (
          <Link href={ctaHref} style={{
            padding: "10px 16px", color: "white",
            background: dark ? C.mint : C.coral,
            fontSize: 9, fontWeight: 900, textTransform: "uppercase",
            textDecoration: "none", borderRadius: 4,
            whiteSpace: "nowrap", transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = dark ? C.coral : C.purple; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = dark ? C.mint : C.coral; }}>
            {ctaLabel}
          </Link>
        )}
      </div>
    </header>
  );
}