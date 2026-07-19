# ArcGent — Architecture & Implementation Plan

## Overview

ArcGent is an autonomous signal-to-payment agent. It listens to verified real-world signals (onchain events, APIs, webhooks), evaluates user-defined rules, and autonomously executes USDC payments via Circle Agent Stack on the Arc network.

## Core Concept

```
┌─────────────────────────────────────────────────────────────┐
│                    "If this, then pay"                       │
│                                                              │
│   IF    signal_condition_met    THEN    execute_payment     │
│                                                              │
│   Signal → Decision → Payment → Settlement                   │
└─────────────────────────────────────────────────────────────┘
```

## Technical Architecture

### 1. Signal Layer

| Source | Signal Types | Implementation |
|--------|-------------|----------------|
| **GitHub** | PR merged, issue closed, push | GitHub REST API polling |
| **API** | Flight delays, weather, stocks, page views | HTTP polling with JSON conditions |
| **Oracle** | Chainlink, Pyth, custom oracles | Onchain event watching |
| **Onchain** | Token transfers, contract calls, approvals | Viem event watching |

### 2. Decision Layer

**Rule Engine** evaluates signal data against user-defined conditions:

```typescript
{
  "signal": {
    "source": "github",
    "trigger": "pull_request.merged",
    "conditions": { "label": "fix" }
  },
  "action": {
    "type": "pay",
    "recipient": "0x...",
    "amount": 50,
    "currency": "USDC"
  }
}
```

### 3. Execution Layer

**Circle Agent Stack** handles wallet operations:
- Developer-controlled wallets
- USDC native transfers on Arc
- ERC-20 transfers via USDC contract
- Transaction monitoring

### 4. Settlement Layer

**Arc Network** provides:
- USDC as native gas token
- Sub-second deterministic finality
- EVM compatibility
- Onchain verification

## Arc Network Details

| Parameter | Value |
|-----------|-------|
| **Chain ID** | 5042002 |
| **RPC URL** | https://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **Gas Token** | USDC (18 decimals native, 6 decimals ERC-20) |
| **USDC Contract** | 0x3600000000000000000000000000000000000000 |

## Key Differences from Standard EVM

1. **USDC is native gas** — No ETH needed. Pay gas in USDC.
2. **Sub-second finality** — Transactions finalize in < 1 second.
3. **Dual USDC interface** — Native (18 decimals) + ERC-20 (6 decimals) share same balance.
4. **EVM compatible** — Solidity, Hardhat, Foundry, Viem all work unchanged.

## Circle Agent Stack Integration

### Prerequisites

```bash
# Install Circle CLI
bun add -g @circle-fin/cli

# Install App Kit SDK
npm install @circle-fin/app-kit

# Install Viem adapter
npm install @circle-fin/adapter-viem-v2 viem
```

### Circle Console Setup

1. Get API key from https://console.circle.com
2. Create entity secret
3. Create developer-controlled wallet
4. Fund wallet with testnet USDC from https://faucet.circle.com

### Kit Key

For Swap capability, get a free kit key from Circle Console.

## Project Structure

```
arcgent/
├── src/
│   ├── index.ts              # Entry point
│   ├── agent.ts              # Core ArcGent agent
│   ├── signals/
│   │   ├── github.ts         # GitHub event listener
│   │   └── api.ts            # External API monitor
│   ├── rules/
│   │   ├── engine.ts         # Rule evaluation engine
│   │   └── schema.ts         # Rule schema definitions
│   ├── payments/
│   │   ├── circle.ts         # Circle Agent Stack wallet
│   │   └── arc.ts            # Arc network interactions
│   └── utils/
│       ├── config.ts         # Configuration management
│       └── logger.ts         # Logging utility
├── config/
│   └── rules.json            # Agent rules configuration
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Implementation Roadmap

### Phase 1: Core Agent (Day 1)
- [x] Project scaffolding
- [x] Rule engine + schema
- [x] Circle wallet integration (Viem)
- [x] Arc network client
- [x] GitHub signal listener
- [x] API signal listener
- [ ] Configuration loading

### Phase 2: Payments (Day 2)
- [ ] Circle App Kit integration (Send)
- [ ] USDC native transfer on Arc
- [ ] Transaction monitoring
- [ ] Payment confirmation tracking
- [ ] Error handling + retries

### Phase 3: Polish (Day 3)
- [ ] CLI interface
- [ ] Real-time signal monitoring
- [ ] Payment history log
- [ ] Landing page (already done: arcgent.html)
- [ ] Demo video
- [ ] Documentation

## Use Cases

### 1. Auto Bug Bounty
```
IF   PR with "fix" label is merged on repo
THEN pay 50 USDC to the PR author
```

### 2. Flight Delay Refund
```
IF   Flight GA123 delayed > 2 hours
THEN refund 100 USDC to traveler's wallet
```

### 3. Content Tip Stream
```
IF   Article reaches 1000 page views
THEN tip 5 USDC to writer's wallet
```

### 4. Gym Accountability
```
IF   No gym activity logged for 7 days
THEN pay 20 USDC to accountability partner
```

## Security Considerations

1. **Private key management** — Use environment variables, never commit
2. **Amount limits** — Cap maximum payment per transaction
3. **Cooldowns** — Prevent rapid-fire duplicate payments
4. **Rule validation** — Schema validation on all rule configs
5. **Signal verification** — Cross-reference signals before payment
6. **Audit trail** — Log all decisions and payments

## API Keys Required

| Service | Purpose | Get Key |
|---------|---------|---------|
| Circle Console | Agent Stack wallets | https://console.circle.com |
| GitHub | PR/issue monitoring | https://github.com/settings/tokens |
| AviationStack | Flight delay data | https://aviationstack.com |
| OpenWeatherMap | Weather data | https://openweathermap.org/api |
| Alpha Vantage | Stock prices | https://www.alphavantage.co |

## License

MIT
