"use client";

import { useEffect, useState } from "react";

const shimmer = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.shimmer {
  background: linear-gradient(90deg, rgba(11,26,51,0.04) 25%, rgba(11,26,51,0.08) 37%, rgba(11,26,51,0.04) 63%);
  background-size: 400px 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
`;

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
  variant?: "text" | "card" | "circle" | "rect";
}

export default function Skeleton({ width, height, style, variant = "text" }: SkeletonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const base: React.CSSProperties = {
    width: width || "100%",
    height: height || (variant === "text" ? 16 : variant === "circle" ? 40 : 200),
    borderRadius: variant === "circle" ? "50%" : variant === "card" ? 8 : 4,
    ...style,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmer }} />
      <div className="shimmer" style={base} />
    </>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ padding: 20, background: "white", borderRadius: 10, border: "1px solid rgba(11,26,51,0.08)" }}>
      <Skeleton width="60%" height={14} />
      <div style={{ height: 8 }} />
      <Skeleton width="40%" height={24} />
      <div style={{ height: 12 }} />
      <Skeleton width="80%" height={10} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(11,26,51,0.05)" }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} width={j === 0 ? "80%" : "60%"} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}
