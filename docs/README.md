# Junoswap

![Live on 6 Chains](https://img.shields.io/badge/Chains-6-blue)
![7 DEXs Integrated](https://img.shields.io/badge/DEXs-7-green)
![Open Source](https://img.shields.io/badge/License-MIT-purple)

**The fastest way to trade tokens across multiple chains.**
Get the best prices across all DEXs with one click. No registration. No KYC. Just connect and swap.

[Swap →](https://v1.junoswap.xyz/swap) · [Bridge →](https://v1.junoswap.xyz/bridge) · [Earn →](https://v1.junoswap.xyz/earn) · [Launchpad →](https://v1.junoswap.xyz/launchpad) · [Documentation →](./architecture.md) · [Discord →](https://discord.gg/caE5wzQBME)

---

### Why Junoswap?

- **Best Prices** — Aggregates quotes from 7 DEXs (JunoSwap, Uniswap, PancakeSwap, Jibswap, Udonswap, Ponder, Diamon) with smart routing
- **6 Chains** — KUB Chain, JB Chain, Worldchain, Base, BNB Chain, and more from a single interface
- **Non-Custodial** — Your funds never leave your wallet. Open-source, built with battle-tested smart contracts
- **Lightning Fast** — Built on Next.js 15 with modern Web3 libraries for instant quotes and fast execution

### Features

- Multi-DEX swap with auto best-rate selection
- Cross-chain bridge via LI.FI (BSC, Base, Worldchain)
- Liquidity management with concentrated liquidity (V3)
- LP mining with real-time reward tracking
- Multi-hop routing for indirect token pairs
- Customizable slippage protection
- Native token wrap (KUB↔WKUB, BNB↔WBNB, JBC↔WJBC)
- Shareable swap configuration links
- Memecoin launchpad with bonding curve (buy/sell/graduate to V3 pool)

### Supported Chains

| Chain | DEXs | Bridge | Explorer |
|-------|------|--------|----------|
| **KUB Chain** | JunoSwap V3, Udonswap, Ponder, Diamon | | [bkcscan.com](https://www.bkcscan.com) |
| **JB Chain** | JunoSwap V3, Jibswap V2 | | [exp-l1.jibchain.net](https://exp-l1.jibchain.net) |
| **KUB Testnet** | JunoSwap V3 | | [testnet.bkcscan.com](https://testnet.bkcscan.com) |
| **Worldchain** | Uniswap V3 | LI.FI | [explorer.alchemy.com](https://worldchain-mainnet.explorer.alchemy.com) |
| **Base** | Uniswap V3 | LI.FI | [basescan.org](https://basescan.org) |
| **BNB Chain** | PancakeSwap V3 | LI.FI | [bscscan.com](https://bscscan.com) |

**Launchpad**: Available on KUB Testnet — create and trade memecoins via bonding curve with automatic V3 pool graduation

---

## For Developers

**Prerequisites:** Bun 1.x+, Node.js 18+. No required env vars — works with public RPCs.

```bash
bun run dev      # Start development server
bun run build    # Build for production
bun run start    # Start production server
```

For tech stack, project structure, architecture, and code reference — see [architecture.md](./architecture.md).

---

## Community

[Docs](./README.md) · [Roadmap](./roadmap.md) · [Architecture](./architecture.md) · [Twitter](https://x.com/junoswaptrade) · [Discord](https://discord.gg/caE5wzQBME) · [GitHub](https://github.com/coshi190/junoswap)

Contributions welcome — UI/UX, testing, docs, smart contracts. 

MIT © 2025 Junoswap
