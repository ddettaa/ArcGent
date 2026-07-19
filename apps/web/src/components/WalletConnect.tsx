"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { useState, useEffect } from 'react'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", coral: "#ff4b31", mint: "#5acda7", purple: "#9f72ff",
}

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isConnected && address) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
        background: "white", border: `1px solid rgba(11,26,51,0.1)`, borderRadius: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: C.mint,
            animation: "pulse 2s infinite",
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <button
            onClick={copyAddress}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 2,
              display: "flex", alignItems: "center",
            }}
          >
            {copied ? <Check size={12} color={C.mint} /> : <Copy size={12} color={C.steel} />}
          </button>
        </div>
        
        {balance && (
          <div style={{ fontSize: 10, color: C.steel }}>
            {parseFloat(balance.formatted).toFixed(2)} {balance.symbol}
          </div>
        )}
        
        <button
          onClick={() => disconnect()}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
            background: "none", border: `1px solid rgba(11,26,51,0.15)`, borderRadius: 4,
            fontSize: 10, color: C.steel, cursor: "pointer",
          }}
        >
          <LogOut size={10} />
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: C.ocean, color: "white", border: "none", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          <Wallet size={14} />
          {isPending ? "Connecting..." : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  )
}

// Simple version for nav bar
export function WalletConnectCompact() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          background: "rgba(90,205,167,0.1)", border: `1px solid rgba(90,205,167,0.3)`,
          borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.mint,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.mint }} />
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            display: "flex", alignItems: "center", color: C.steel,
          }}
        >
          <LogOut size={12} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      disabled={isPending || !connectors[0]}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
        background: C.purple, color: "white", border: "none", borderRadius: 6,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
        opacity: (isPending || !connectors[0]) ? 0.7 : 1,
      }}
    >
      <Wallet size={12} />
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  )
}
