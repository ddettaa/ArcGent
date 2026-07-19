# ArcGent

Autonomous signal-to-payment agents on Arc + Circle Agent Stack

## Concept

ArcGent is an AI agent that autonomously executes USDC payments based on verified real-world signals. "If this, then pay" — but for onchain.

**If {signal} → Pay {recipient} {amount} USDC**

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Signals   │────▶│   ArcGent    │────▶│  Circle Wallet  │
│  (offchain) │     │   (Agent)    │     │  (USDC payment) │
│  (onchain)  │     │  (Listener)  │     │  (onchain)      │
└─────────────┘     │  (Decider)   │     └─────────────────┘
                    │  (Executor)  │
                    └──────────────┘
```

## Features

- **Listen**: Monitors verified signal sources (GitHub, APIs, oracles, onchain events)
- **Decide**: LLM-powered rule engine evaluates trigger conditions
- **Pay**: Autonomous USDC payment execution via Circle Agent Stack

## Use Cases

| Signal | Rule | Action |
|--------|------|--------|
| PR merged with `fix:` label | Bug bounty complete | Pay 50 USDC → developer |
| Flight delayed > 2h | Refund triggered | Pay 100 USDC → traveler |
| Content hits 1000 reads | Creator milestone | Tip 5 USDC → writer |
| Strava no gym all week | Accountability check | Pay 20 USDC → partner |

## Tech Stack

- **Arc Network** — L1 with USDC gas token
- **Circle Agent Stack** — Agent wallets, USDC payments
- **Circle App Kit** — Bridge, Swap, Send, Unified Balance
- **Viem** — EVM adapter for Arc

## Setup

```bash
# Install dependencies
bun install

# Setup Circle CLI
bun add -g @circle-fin/cli

# Configure environment
cp .env.example .env
# Add your Circle API key, Arc RPC endpoint, wallet config

# Run agent
bun run agent
```

## Project Structure

```
src/
├── index.ts          # Entry point
├── agent.ts          # ArcGent core agent
├── signals/
│   ├── github.ts     # GitHub signal listener
│   ├── oracle.ts     # Onchain oracle reader
│   └── api.ts        # External API monitor
├── rules/
│   ├── engine.ts     # Rule evaluation engine
│   └── schema.ts     # Rule schema/validation
├── payments/
│   ├── circle.ts     # Circle Agent Stack integration
│   └── arc.ts        # Arc network interactions
└── utils/
    ├── config.ts     # Configuration
    └── logger.ts     # Logging
```

## License

MIT
