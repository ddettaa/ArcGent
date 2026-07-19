# ArcGent

Autonomous signal-to-payment agents on Arc + Circle Agent Stack

## Monorepo Structure

```
arcgent/
├── apps/
│   ├── web/                  # Frontend — Next.js dashboard
│   └── agent/                # Backend — Autonomous agent (Bun)
├── packages/
│   └── shared/               # Shared types, schemas, constants
├── .env.example
├── ARCHITECTURE.md
└── README.md
```

## Quick Start

### Prerequisites

- [Bun](https://bun.com) 1.2+
- Circle API key from [Circle Console](https://console.circle.com)
- Arc Testnet RPC access

### Setup

```bash
# Install all dependencies
bun install

# Setup environment
cp .env.example .env
# Fill in your Circle + Arc credentials

# Run the agent (backend)
bun run dev:agent

# Run the dashboard (frontend)
bun run dev:web
```

## Apps

### `apps/agent` — Autonomous Agent

The core ArcGent agent. Monitors signals, evaluates rules, executes USDC payments.

```bash
cd apps/agent
bun run dev
```

**What it does:**
- Listens to GitHub, API, oracle, and onchain signals
- Evaluates user-defined rules ("if this, then pay")
- Sends USDC via Circle Agent Stack on Arc network
- Sub-second finality on Arc (chain ID 5042002)

### `apps/web` — Dashboard

Next.js frontend for monitoring and configuring the agent.

```bash
cd apps/web
bun run dev
```

**Features:**
- Real-time agent status
- Rule management (create/edit/enable/disable)
- Payment history
- Wallet balance monitoring
- Signal log viewer

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Arc Network (L1, USDC gas) |
| Wallet | Circle Agent Stack |
| SDK | @circle-fin/app-kit |
| EVM Adapter | @circle-fin/adapter-viem-v2 + viem |
| Agent Runtime | Bun + TypeScript |
| Frontend | Next.js + Tailwind CSS |
| Package Manager | Bun workspaces |

## Arc Network

| Parameter | Value |
|-----------|-------|
| **Chain ID** | 5042002 |
| **RPC URL** | https://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **Gas Token** | USDC (native, 18 decimals) |
| **USDC ERC-20** | 0x3600000000000000000000000000000000000000 |

## License

MIT
