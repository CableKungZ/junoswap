# CMswap

![Live on 6 Chains](https://img.shields.io/badge/Chains-6-blue)
![7 DEXs Integrated](https://img.shields.io/badge/DEXs-7-green)
![Open Source](https://img.shields.io/badge/License-MIT-purple)

**The fastest way to trade tokens across multiple chains.**
Get the best prices across all DEXs with one click. No registration. No KYC. Just connect and swap.

[Swap →](/swap) · [Earn →](/earn) · [Documentation →](./architecture.md) · [Discord →](https://discord.gg/k92ReT5EYy)

---

### Why CMswap?

- **Best Prices** — Aggregates quotes from 7 DEXs (CMswap, Uniswap, PancakeSwap, Jibswap, Udonswap, Ponder, Diamon) with smart routing
- **6 Chains** — KUB Chain, JB Chain, Worldchain, Base, BNB Chain, and more from a single interface
- **Non-Custodial** — Your funds never leave your wallet. Open-source, built with battle-tested smart contracts
- **Lightning Fast** — Built on Next.js 15 with modern Web3 libraries for instant quotes and fast execution

### Features

- Multi-DEX swap with auto best-rate selection
- Liquidity management with concentrated liquidity (V3)
- LP mining with real-time reward tracking
- Multi-hop routing for indirect token pairs
- Customizable slippage protection
- Native token wrap (KUB↔WKUB, BNB↔WBNB, JBC↔WJBC)
- Shareable swap configuration links

### Supported Chains

| Chain | DEXs | Explorer |
|-------|------|----------|
| **KUB Chain** | CMswap V3, Udonswap, Ponder, Diamon | [bkcscan.com](https://www.bkcscan.com) |
| **JB Chain** | CMswap V3, Jibswap V2 | [exp-l1.jibchain.net](https://exp-l1.jibchain.net) |
| **KUB Testnet** | CMswap V3 | [testnet.bkcscan.com](https://testnet.bkcscan.com) |
| **Worldchain** | Uniswap V3 | [explorer.alchemy.com](https://worldchain-mainnet.explorer.alchemy.com) |
| **Base** | Uniswap V3 | [basescan.org](https://basescan.org) |
| **BNB Chain** | PancakeSwap V3 | [bscscan.com](https://bscscan.com) |

---

## For Developers

**Prerequisites:** Bun 1.x+, Node.js 18+. No required env vars — works with public RPCs.

```bash
bun run dev      # Start development server
bun run build    # Build for production
bun run start    # Start production server
bun run lint     # Run ESLint
```

For tech stack, project structure, architecture, and code reference — see [architecture.md](./architecture.md).

---

## Community

[Docs](./README.md) · [Roadmap](./roadmap.md) · [Architecture](./architecture.md) · [Twitter](https://x.com/cmswap) · [Discord](https://discord.gg/k92ReT5EYy) · [GitHub](https://github.com/coshi190/cmswap)

Contributions welcome — UI/UX, testing, docs, smart contracts. 

MIT © 2025 CMswap
