# Junoswap Architecture

---

## System Overview

Junoswap is a multi-chain DeFi app — swap tokens across 7 DEXs, manage concentrated liquidity positions, and earn rewards from LP mining, all on 6 EVM chains.

```
User Interface
  Pages: Landing · Swap · Earn · Bridge · Launchpad
  Shared: Wallet · Settings · Navigation
  → app/ · components/
    ↓
Business Logic
  Multi-DEX Aggregation · LP Management
  Quote Comparison · Mining Rewards
  → hooks/ · store/ · services/
    ↓
Blockchain Layer
  wagmi + viem · 6 EVM Chains
  Contract ABIs · RPC Providers
  → lib/abis/ · lib/wagmi.ts · lib/dex-config.ts
```

---

## Architecture Principles

### Rendering Strategy

**Decision**: Landing page uses SSG (Static Site Generation); all feature pages (Swap, Bridge, Earn) are client-side only.

**Why**: The landing page needs fast load times and SEO indexing. Feature pages require wallet connection and real-time blockchain state, which can only run in the browser.

**Trade-off**: Feature pages have a blank-shell initial load — the UI only renders after JS hydrates and wallet state resolves.

### State Management

**Decision**: Zustand for client-side state (swap form, earn tabs). TanStack Query for async server state (balances, quotes). No Redux.

**Why**: Swap form state is purely client-side and doesn't need Redux complexity. TanStack Query handles caching and invalidation of blockchain data (balances: 30s stale time, quotes: no cache) better than manual state.

### Multi-DEX Design

**Decision**: All DEXs queried in parallel with a unified interface. Results compared and sorted by output amount.

**Why**: No single DEX has the best price for every pair. Parallel queries add zero latency since RPC calls are independent. The unified interface (`lib/dex-config.ts`) makes adding new DEXs a config change, not a code change.

**Trade-off**: More RPC calls per quote — mitigated by 500ms input debouncing, which reduces total calls by ~80%.

### Chain Coverage

**Decision**: Support KUB (primary), JBC (partner), and BSC/Base/World (liquidity hubs). Use wagmi's multi-chain config for all chains simultaneously.

**Why**: KUB and JBC are the target ecosystems. BSC, Base, and Worldchain are added for their deep liquidity — users can access major tokens without leaving the app.

---

## Frontend Architecture

### Routes

```
/              # Landing page (SSG)
/swap          # Swap feature (client-side)
/earn          # Earn feature: LP positions + mining (client-side)
/bridge        # Bridge feature (client-side)
/launchpad     # Launchpad feature (coming)
/points        # Points feature (coming)
```

### Component Structure

```
components/
├── ui/                    # shadcn/ui base components (14)
│   └── (button, dialog, dropdown, etc.)
│
├── landing/               # Landing page sections
│   ├── hero.tsx           # Hero with CTA
│   ├── features.tsx       # Features grid
│   ├── chains.tsx         # Supported chains
│   ├── cta.tsx            # Call-to-action
│   └── footer.tsx         # Footer
│
├── layout/
│   └── header.tsx         # Nav + wallet integration
│
├── web3/                  # Wallet connection (4 components)
│   ├── connect-button.tsx # Connection trigger
│   ├── connect-modal.tsx  # Wallet selector
│   ├── account-dropdown.tsx # Account actions
│   └── network-switcher.tsx # Chain switcher
│
└── swap/                  # Swap feature (4 components)
    ├── swap-card.tsx      # Main interface
    ├── dex-select-card.tsx # DEX comparison
    ├── token-select.tsx   # Token selector
    └── settings-dialog.tsx # Slippage/deadline
│
├── positions/             # LP position management (7 components)
│   ├── positions-list.tsx # User's LP positions
│   ├── pools.tsx          # Available pools list
│   ├── add-liquidity-dialog.tsx # Create LP position
│   ├── remove-liquidity-dialog.tsx # Remove liquidity
│   ├── increase-liquidity-dialog.tsx # Add to existing
│   ├── collect-fees-dialog.tsx # Collect trading fees
│   ├── position-details-modal.tsx # Position details
│   └── range-selector.tsx # Price range for V3
│
└── mining/                # LP mining/staking (5 components)
    ├── mining-pools.tsx   # Available mining pools
    ├── incentive-card.tsx # Pool incentive card
    ├── stake-dialog.tsx   # Stake LP position
    ├── unstake-dialog.tsx # Unstake + claim rewards
    └── staked-positions.tsx # User's staked positions
│
└── bridge/                # Bridge feature (3 components)
    ├── bridge-card.tsx    # Main bridge interface
    ├── bridge-status.tsx  # 3-phase status tracker (polls every 10s)
    └── chain-select.tsx   # Chain dropdown (filtered to supported chains)
```

---

## Web3 Integration

### Supported Chains

| Chain | Chain ID | RPC | Explorer | Status |
|-------|----------|-----|----------|--------|
| KUB Testnet | 25925 | rpc-testnet.bitkubchain.io | testnet.bkcscan.com | ✅ Active |
| KUB Mainnet | 96 | rpc.bitkubchain.io | bkcscan.com | ✅ Active |
| JBC Chain | 8899 | rpc-l1.jibchain.net | exp-l1.jibchain.net | ✅ Active |
| Base | 8453 | mainnet.base.org | basescan.org | ✅ Active |
| Worldchain | 480 | worldchain-mainnet.g.alchemy.com/public | worldchain-mainnet.explorer.alchemy.com | ✅ Active |
| BNB Chain | 56 | 56.rpc.thirdweb.com | bscscan.com | ✅ Active |

**Config**: `lib/wagmi.ts`

### DEX Configuration

| DEX | Priority | Protocol | Chains | Status |
|-----|----------|----------|--------|--------|
| JunoSwap | 1 | Uniswap V3 | KUB Testnet, JBC, KUB Mainnet | ✅ Active |
| Uniswap | 1 | Uniswap V3 | Worldchain, Base | ✅ Active |
| PancakeSwap | 1 | PancakeSwap V3 | BSC | ✅ Active |
| Jibswap | 2 | Uniswap V2 | JBC | ✅ Active |
| UdonSwap | 3 | Uniswap V2 | KUB Mainnet | ✅ Active |
| Ponder Finance | 4 | Uniswap V2 | KUB Mainnet | ✅ Active |
| Diamon Finance | 5 | Uniswap V2 | KUB Mainnet | ✅ Active |

**Config**: `lib/dex-config.ts`

**KUB Testnet (JunoSwap V3)**:
- Factory: `0xCBd41F872FD46964bD4Be4d72a8bEBA9D656565b`
- Quoter: `0x3F64C4Dfd224a102A4d705193a7c40899Cf21fFe`
- Router: `0x3C5514335dc4E2B0D9e1cc98ddE219c50173c5Be`
- Fee Tiers: 100, 500, 3000, 10000

**JBC Chain**:
- JunoSwap (V3): Factory `0x5835f123bDF137864263bf204Cf4450aAD1Ba3a7`, Quoter `0x5ad32c64A2aEd381299061F32465A22B1f7A2EE2`, Router `0x2174b3346CCEdBB4Faaff5d8088ff60B74909A9d`
- Jibswap (V2): Factory `0x4BBdA880C5A0cDcEc6510f0450c6C8bC5773D499`, Router `0x766F8C9321704DC228D43271AF9b7aAB0E529D38`

**KUB Mainnet**:
- JunoSwap (V3): Factory `0x090C6E5fF29251B1Ef9EC31605Bdd13351eA316C`, Quoter `0xCB0c6E78519f6B4c1b9623e602E831dEf0f5ff7f`, Router `0x3F7582E36843FF79F173c7DC19f517832496f2D8`
- UdonSwap (V2): Factory `0x18c7a4CA020A0c648976208dF2e3AE1BAA32e8d1`, Router `0x7aA32A818cD3a6BcdF827f6a411B7adFF56e7A4A`
- Ponder Finance (V2): Factory `0x20B17e92Dd1866eC6747ACaA38fe1f7075e4B359E`, Router `0xD19C5cebFa9A8919Cc3db2F19163089feBd9604E`
- Diamon Finance (V2): Factory `0x6E906Dc4749642a456907deCB323A0065dC6F26E`, Router `0xAb30a29168D792c5e6a54E4bcF1Aec926a3b20FA`

**Worldchain**:
- Uniswap (V3): Factory `0x7a5028BDa40e7B173C278C5342087826455ea25a`, Quoter `0x10158D43e6cc414deE1Bd1eB0EfC6a5cBCfF244c`, Router `0x091AD9e2e6e5eD44c1c66dB50e49A601F9f36cF6`

**Base**:
- Uniswap (V3): Factory `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`, Quoter `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`, Router `0x2626664c2603336E57B271c5C0b26F421741e481`

**BSC (BNB Chain)**:
- PancakeSwap (V3): Factory `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`, Quoter `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`, Router `0x1b81D678ffb9C0263b24A97847620C99d213eB14`
- Fee Tiers: 100, 500, 2500, 10000 (NOTE: PancakeSwap uses 0.25% (2500) instead of Uniswap's 0.3% (3000))

---

## Swap Feature Architecture

### Multi-DEX System

```
User inputs amount
  └─> Debounced (500ms)
  └─> useMultiDexQuotes: Fetch all DEXs in parallel
      ├─> V3: Direct + Multi-hop routes
      └─> V2: Direct + Multi-hop routes
  └─> Compare outputs, select best
  └─> DexSelectCard: Show all options
  └─> User clicks Swap
      └─> Check allowance → Approve if needed
      └─> Build transaction (V2 or V3)
      └─> Simulate → User confirms → Execute
```

### Routing Logic

**Direct Route**: Token A → Token B (single pool)
**Multi-Hop**: Token A → Intermediate → Token B (better if 0.5%+ improvement)

**Services**: `services/dex/uniswap-v3.ts`, `services/dex/uniswap-v2.ts`
**Hooks**: `hooks/useSwapRouting.ts`, `hooks/useMultiDexQuotes.ts`

### Features

- Multi-DEX quotes with price comparison across 7 DEXs
- Auto-select best DEX (optional)
- Multi-hop routing for better rates
- Slippage protection (0.1%, 0.5%, 1%, custom)
- Transaction deadline settings
- Wrap/unwrap native tokens (KUB↔KKUB, BNB↔WBNB, JBC↔WJBC, ETH↔WETH)
- Transaction simulation before execution
- Shareable swap links (URL parameter sync)
- Batch RPC calls for efficient balance fetching
- Price comparison UI with percentage difference display
- Special token handling (e.g., KUSDT non-standard allowance)
- Multi-protocol support (V2 + V3 simultaneously)

**Execution Hooks**: `hooks/useUniV3SwapExecution.ts`, `hooks/useUniV2SwapExecution.ts`

### Multi-DEX Quote Aggregation

```
User inputs amount
  └─> Debounced (500ms)
  └─> useMultiDexQuotes: Fetch ALL DEXs in parallel
      ├─> JunoSwap V3: Direct + Multi-hop routes
      ├─> Jibswap V2: Direct + Multi-hop routes
      ├─> UdonSwap V2: Direct + Multi-hop routes
      ├─> Ponder Finance V2: Direct + Multi-hop routes
      ├─> Diamon Finance V2: Direct + Multi-hop routes
      ├─> Uniswap V3: Direct + Multi-hop routes
      └─> PancakeSwap V3: Direct + Multi-hop routes
  └─> Compare outputs, calculate % difference
  └─> Auto-select best price (if enabled)
  └─> DexSelectCard: Show all options with comparison
  └─> User clicks Swap → Execute with selected DEX
```

**Priority Order**: JunoSwap (1) → Uniswap (1) → PancakeSwap (1) → Jibswap (2) → UdonSwap (3) → Ponder Finance (4) → Diamon Finance (5)

**Config**: `lib/dex-config.ts` - Priority-based DEX registry

---

## Earn Feature Architecture

### LP Position Management

```
User navigates to /earn
  └─> Tab 1: Pools - Browse available liquidity pools
  └─> Tab 2: My Positions - View owned LP positions
  └─> User clicks "Add Liquidity"
      └─> Select pool, enter amounts, set price range (V3)
      └─> Approve tokens → Create position
  └─> User clicks position → View details
      └─> Collect fees, Add/Remove liquidity, View P&L
```

**Components**: `components/positions/`
**Hooks**: `hooks/usePositions.ts`, `hooks/usePools.ts`

### LP Mining (Stake to Earn)

```
User navigates to /earn → Mining tab
  └─> MiningPools: List available incentives per chain
  └─> User clicks "Stake" on pool
      └─> StakeDialog: Select eligible LP position
      └─> Two-step approval:
          1. Approve NFT position (if needed)
          2. Stake to incentive program
      └─> StakedPositions: View staked positions + pending rewards
  └─> User clicks "Unstake"
      └─> UnstakeDialog: Shows pending rewards
      └─> Unstake + Claim + Withdraw in one transaction
```

**Components**: `components/mining/`
**Hooks**: `hooks/useIncentives.ts`, `hooks/useStakedPositions.ts`, `hooks/useStaking.ts`, `hooks/useRewards.ts`

### Features

- Create LP positions with concentrated liquidity (V3)
- Add/remove liquidity from existing positions
- Collect trading fees from LP positions
- Real-time P&L tracking for positions
- Stake LP positions to earn token rewards
- Real-time reward calculation and tracking
- Multi-chain incentive programs
- Automatic reward claiming on unstake

**Services**: `services/mining/incentives.ts`, `services/mining/staking.ts`, `services/mining/rewards.ts`
**Store**: `store/earn-store.ts`

---

## Bridge Feature Architecture

### LI.FI Integration

```
User selects chains + tokens + amount
  └─> Debounced (500ms)
  └─> useBridgeQuote: fetchBridgeRoutes (RECOMMENDED order)
      └─> Returns ranked routes from LI.FI aggregators
  └─> Display best route with fees, gas, and estimated time
  └─> User clicks Bridge
      └─> Check allowance → Approve if needed
      └─> executeRoute via LI.FI SDK
      └─> BridgeStatus: Poll getStatus every 10s
          ├─> Source phase (tx submitted on fromChain)
          ├─> Bridging phase (cross-chain relay)
          └─> Destination phase (funds received on toChain)
```

**Provider**: LI.FI SDK v3.16.3
**Supported Chains**: BNB Chain (56), Base (8453), Worldchain (480)
**Integrator Fee**: 3% (requires LI.FI whitelisting)
**Default Slippage**: 3% (configurable)

**Config**: `lib/lifi.ts`
**Services**: `services/bridge/lifi.ts`

### Route Fetching

- Uses `fetchBridgeRoutes` (getRoutes API) with `order: RECOMMENDED` for best-route selection
- AbortController cancels stale requests when inputs change
- Extracts fee breakdown, gas cost (USD), and estimated execution duration from route response
- Quote automatically refetches when chain, token, amount, or slippage changes

**Hook**: `hooks/useBridgeQuote.ts`

### Bridge Execution

- Calls `executeRoute` from LI.FI SDK — SDK handles full tx lifecycle via registered EVM provider
- Status polling via `getStatus` every 10 seconds with 3-phase tracking:
  - **Source**: transaction confirmed on origin chain
  - **Bridging**: cross-chain relay in progress
  - **Destination**: funds received on target chain
- Toast notifications on success/failure
- Unsupported chains show EmptyState with chain-switch prompt

**Hook**: `hooks/useBridgeExecution.ts`
**Component**: `components/bridge/bridge-status.tsx`

### Features

- Cross-chain token transfers across BSC, Base, and Worldchain
- Automatic best-route selection via LI.FI aggregation
- Fee breakdown with gas cost and integrator fee display
- Estimated execution duration per route
- Configurable slippage protection
- 3-phase real-time status tracking with explorer links
- Direction swap (flip from/to chains and tokens)
- Unsupported chain detection with switch prompt

**Page**: `app/bridge/page.tsx`
**Store**: `store/bridge-store.ts`

---

## State Management

### Zustand Store

**Location**: `store/swap-store.ts`

Manages swap state with:
- Token selection (input/output pairs, amounts)
- Quote results with loading/error states
- DEX selection and multi-DEX quotes
- Settings (slippage, deadline, expert mode, auto-select)
- LocalStorage persistence for settings

**Location**: `store/earn-store.ts`

Manages earn state with:
- Tab navigation (Pools, My Positions, Mining)
- Mining modal states (stake/unstake dialogs)
- Selected incentive/staked position
- Settings (hide ended incentives)
- LocalStorage persistence for settings

**Location**: `store/bridge-store.ts`

Manages bridge state with:
- Chain selection (fromChainId, toChainId) with direction swap
- Token selection (fromToken, toToken)
- Input amount with quote invalidation on change
- Route quote with loading/error states
- Settings (slippage)
- LocalStorage persistence for settings only

### Caching (TanStack Query)

- Balance queries: 30s stale time
- Quote queries: No cache (real-time)
- Config: `app/providers.tsx`

---

## Security

### Implemented Measures

1. **No Private Keys** - All signing in user's wallet
2. **External Links** - `rel="noopener noreferrer"` on explorer links
3. **Clipboard Security** - Try/catch with user feedback
4. **User Rejection** - Error code 4001 handled gracefully
5. **TypeScript Strict Mode** - Type safety enforced
6. **Transaction Simulation** - All swaps simulated before execution
7. **Balance Validation** - Checks sufficient balance before swap
8. **Allowance Validation** - Checks token allowance before swap
9. **Slippage Protection** - User-defined limits enforced
10. **Deadline Protection** - Transactions expire after user deadline

---

## Performance

### Optimizations

1. **Static Generation** - Landing page pre-rendered
2. **Code Splitting** - Route-based automatic with Next.js
3. **Cookie Storage** - SSR-compatible state storage
4. **Image Optimization** - Next.js Image for chain logos
5. **Input Debouncing** - 500ms reduces RPC calls 80%+
6. **Aggressive Caching** - 30s stale time for balances
7. **Parallel Quotes** - Multiple DEXs queried simultaneously
8. **Smart Route Caching** - Quotes cached with proper invalidation

---

## Deployment

### Architecture

```
Vercel Edge
  └─> Next.js Application (Serverless Functions)
      ├─> Static Assets (CDN cached)
      ├─> API Routes (if needed)
      └─> Edge Functions (dynamic)
```

### RPC Providers

- BSC: thirdweb.com
- KUB/Testnet: bitkubchain.io
- JBC: rpc.jibchain.net
- Base: base.org
- World: alchemy.com

---

## Monitoring

- **Vercel Analytics** - Page views, Web Vitals
- **Sentry** - Error tracking (active)

---

## Code Reference

### Type Definitions
- `types/swap.ts` - Swap parameters, quotes, settings
- `types/dex.ts` - DEX types, metadata, registry
- `types/tokens.ts` - Token types, balances, approvals
- `types/routing.ts` - Route types, pool info
- `types/web3.ts` - Wallet connection types
- `types/earn.ts` - LP positions, incentives, staking, rewards
- `types/bridge.ts` - Bridge state, settings, supported chain IDs

### Services
- `services/tokens.ts` - Token balances, allowances, approvals
- `services/dex/uniswap-v3.ts` - V3 quoting, routing, execution
- `services/dex/uniswap-v2.ts` - V2 quoting, routing, execution
- `services/mining/incentives.ts` - Incentive status utilities
- `services/mining/staking.ts` - Staking transaction encoding
- `services/mining/rewards.ts` - Reward calculation
- `services/bridge/lifi.ts` - LI.FI quote/routes/execution/status

### Hooks
- `hooks/useMultiDexQuotes.ts` - Aggregate all DEX quotes
- `hooks/useSwapRouting.ts` - Direct and multi-hop routing
- `hooks/useUniV3Quote.ts` - V3 single-hop quoting
- `hooks/useUniV2Quote.ts` - V2 single-hop quoting
- `hooks/useUniV3MultiHopQuote.ts` - V3 multi-hop quoting
- `hooks/useUniV2MultiHopQuote.ts` - V2 multi-hop quoting
- `hooks/useUniV3SwapExecution.ts` - V3 swap execution
- `hooks/useUniV2SwapExecution.ts` - V2 swap execution
- `hooks/useTokenBalance.ts` - Token balance fetching
- `hooks/useTokenApproval.ts` - Approval flow
- `hooks/useSwapUrlSync.ts` - URL parameter sync
- `hooks/useDebounce.ts` - Input debouncing
- `hooks/usePositions.ts` - LP position management
- `hooks/usePools.ts` - Pool data fetching
- `hooks/useIncentives.ts` - Incentive programs
- `hooks/useStakedPositions.ts` - Staked positions tracking
- `hooks/usePendingRewards.ts` - Pending rewards calculation
- `hooks/useStaking.ts` - Stake/unstake transactions
- `hooks/useBridgeQuote.ts` - Debounced route fetching with fee/gas breakdown
- `hooks/useBridgeExecution.ts` - Route execution with status tracking

### ABIs
- `lib/abis/erc20.ts` - ERC20 token standard
- `lib/abis/weth9.ts` - WETH9 wrapped native token
- `lib/abis/uniswap-v2-factory.ts` - V2 factory
- `lib/abis/uniswap-v2-router.ts` - V2 router
- `lib/abis/uniswap-v2-pair.ts` - V2 pair
- `lib/abis/uniswap-v3-factory.ts` - V3 factory
- `lib/abis/uniswap-v3-quoter.ts` - V3 quoter
- `lib/abis/uniswap-v3-pool.ts` - V3 pool
- `lib/abis/uniswap-v3-swap-router.ts` - V3 router
- `lib/abis/uniswap-v3-staker.ts` - V3 staker for LP mining
- `lib/abis/nonfungible-position-manager.ts` - V3 NFT positions
- `lib/abis/uniswap-v3-pool.ts` - V3 pool state

### Utilities
- `lib/utils.ts` - `cn()` class merger, `formatAddress()`
- `lib/toast.ts` - Toast notification helpers
- `lib/routing-config.ts` - Routing configuration
- `lib/swap-params.ts` - Swap parameter builders
- `lib/tokens.ts` - Token lists and utilities
- `lib/dex-config.ts` - DEX registry

---

## Dependencies

**Core**: Next.js 15.2, React 19, TypeScript 5.8
**Web3**: wagmi 2.15, viem 2.25, @tanstack/react-query 5.62
**Bridge**: @lifi/sdk 3.16.3
**State**: Zustand 5.0
**UI**: Radix UI, Tailwind 3.4, lucide-react, framer-motion, sonner
**Dev**: ESLint 9, Prettier 3.4, Husky 9.1, Vitest 2.1, Playwright 1.49
**Other**: React Hook Form 7.55, Zod 3.24
