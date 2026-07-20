"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

interface Notification {
  id: string;
  event: string;
  message: string;
  amount?: string;
  txHash?: string;
  timestamp: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log("[WS] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "connected") return;
          
          const notif: Notification = {
            id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            event: data.event,
            message: formatMessage(data),
            amount: data.data?.amount ? (data.data.amount / 1_000_000).toFixed(4) + " USDC" : undefined,
            txHash: data.data?.txHash,
            timestamp: data.ts || Date.now(),
          };
          
          setNotifications(prev => [notif, ...prev].slice(0, 20));
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 5s
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, connected, dismiss };
}

function formatMessage(data: any): string {
  switch (data.event) {
    case "payment":
      return `💰 Payment sent: ${(data.data?.amount / 1_000_000).toFixed(4)} USDC`;
    case "nanopayment":
      return `⚡ Nanopayment: ${(data.data?.amount / 1_000_000).toFixed(6)} USDC`;
    case "approval":
      return `🔔 Approval needed: ${data.data?.reason || "manual review"}`;
    case "rule_triggered":
      return `🎯 Rule triggered: ${data.data?.ruleName || data.data?.ruleId}`;
    case "agent_hired":
      return `🤝 Agent hired: ${data.data?.serviceId}`;
    default:
      return `📢 ${data.event}: ${JSON.stringify(data.data).slice(0, 80)}`;
  }
}

// --- Toast Notification Component ---
export function NotificationToasts() {
  const { notifications, connected, dismiss } = useNotifications();
  const [visible, setVisible] = useState(true);

  if (!visible || notifications.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      {/* Connection indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: connected ? "#5acda7" : "#ff4b31", marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#5acda7" : "#ff4b31" }} />
        {connected ? "Live" : "Reconnecting..."}
      </div>

      {notifications.slice(0, 5).map((n) => (
        <div key={n.id} style={{
          background: "#0b1a33", color: "white", borderRadius: 8,
          padding: "12px 16px", fontSize: 11, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          boxShadow: "0 4px 20px rgba(11,26,51,0.3)",
          animation: "slideIn 0.3s ease-out",
        }}>
          <div>
            <div>{n.message}</div>
            {n.amount && <div style={{ fontSize: 10, color: "#5acda7", marginTop: 2 }}>{n.amount}</div>}
            {n.txHash && (
              <a href={`https://testnet.arcscan.app/tx/${n.txHash}`} target="_blank" rel="noopener"
                style={{ fontSize: 9, color: "#acc6e9", textDecoration: "none", marginTop: 2, display: "block" }}>
                View on Explorer ↗
              </a>
            )}
          </div>
          <button onClick={() => dismiss(n.id)} style={{
            background: "none", border: "none", color: "#acc6e9",
            fontSize: 14, cursor: "pointer", padding: 2,
          }}>×</button>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}