# Junoswap Roadmap

Implementation phases and TODO list for Junoswap development.

## Project Status

**Current Phase**: Phase 5 - Launchpad Feature (Smart Contracts Complete, Frontend In Progress - KUB Testnet)

- [x] Phase 1: Foundation ✅
- [x] Phase 2: Swap Feature & Multi-Chain Expansion ✅
- [x] Phase 3: Earn Feature ✅
- [x] Phase 4: Bridge Feature ✅
- [ ] Phase 5: Launchpad Feature (Smart Contracts ✅, Frontend KUB Testnet ✅)
- [ ] Phase 6: Points Feature
- [ ] Phase 7: Polish & Optimization
- [ ] Phase 8: Advanced Features (Post-MVP)
- [ ] Phase 9: Subgraph & Analytics (Post-MVP)

---

## Phase 1: Foundation ✅ (COMPLETE)

**Duration**: Completed
**Goal**: Set up project infrastructure

### Completed Tasks

- [x] Initialize Next.js 15 with Bun
- [x] Configure TypeScript
- [x] Set up Tailwind CSS
- [x] Install shadcn/ui
- [x] Configure wagmi + viem (using wagmi directly, no AppKit dependency)
- [x] Configure TanStack Query
- [x] Create multi-chain configuration (6 chains)
- [x] Build landing page
  - [x] Hero section
  - [x] Features grid
  - [x] Supported chains display
  - [x] CTA section
  - [x] Footer
- [x] Set up dev tools (ESLint, Prettier, Husky)
- [x] Create project documentation
- [x] Configure Vercel deployment

---

## Phase 2: Swap Feature & Multi-Chain Expansion ✅ (COMPLETE)

**Duration**: Completed
**Goal**: Implement multi-DEX swap with direct smart contract integration and expand to multiple chains

**Progress**: 100% complete (6 of 6 chains integrated)

### Completed Features ✅

- [x] Multi-DEX swap system with V2 and V3 protocol support
- [x] Token approval and swap execution with transaction simulation
- [x] Multi-hop routing for better prices
- [x] Shareable swap links with URL parameter sync
- [x] Slippage protection and deadline settings
- [x] Price comparison UI across multiple DEXs

### Completed Chain Integrations ✅

- [x] **KUB Testnet** - JunoSwap V3
- [x] **KUB Mainnet** - JunoSwap V3, Udonswap V2, Ponder Finance V2, Diamon Finance V2
- [x] **JB Chain** - JunoSwap V3, Jibswap V2
- [x] **Worldchain** - Uniswap V3
- [x] **Base** - Uniswap V3
- [x] **BSC** - PancakeSwap V3 (0.25% fee tier)

---

## Phase 3: Earn Feature ✅ (COMPLETE)

**Duration**: Completed
**Goal**: Implement LP position management and LP mining (stake LP tokens to earn rewards)

### Completed ✅

- [x] Full LP Position Management: add/remove liquidity, range selection (V3), position tracking, fee collection
- [x] Full LP Mining implementation: stake/unstake dialogs, mining pools list, real-time rewards calculation, staking positions tracker
- [x] All components, hooks, services, and transaction handling complete using Uniswap V3 Staker

---

## Phase 4: Bridge Feature ✅ (COMPLETE)

**Duration**: Completed
**Goal**: Integrate LI.FI SDK for cross-chain token transfers

### Completed ✅

- [x] LI.FI SDK integration with custom UI: bridge quotes, execution, status tracking, chain selector
- [x] Bridge card UI with collapsible fee breakdown, chain selection, and bridge status components
- [x] Integrator fee configuration (3%), Zustand store, hooks, and services complete

---

## Phase 5: Launchpad Feature

**Duration**: 2 weeks
**Goal**: Implement memecoin launch platform using bonding curve mechanism
**Architecture**: Pump.fun-style bonding curve with automatic Uniswap V3 pool creation on graduation

### Smart Contracts ✅ (COMPLETE)

- [x] Bonding curve launch contract (`PumpCoreNative.sol`)
  - [x] Token creation with name, symbol, logo, description, and social links
  - [x] Buy/sell via constant-product bonding curve (1% fee)
  - [x] Graduation mechanism: migrates liquidity to Uniswap V3 pool when threshold reached
  - [x] LP tokens sent to burn address (`0xdead`) on graduation
- [x] ERC20 token contract (`ERC20Token.sol`) — constructor-based minting
- [x] Deployment script for KUB Testnet (`DeployPumpCoreNative.s.sol`)
- [x] Comprehensive test suite (`PumpCoreNative.t.sol`) with mock contracts

```solidity
// contracts/src/
├── PumpCoreNative.sol         # Bonding curve launch contract ✅
├── ERC20Token.sol             # Simple ERC20 ✅
└── interfaces/
    ├── v3-core/               # Uniswap V3 core interfaces ✅
    └── v3-periphery/          # Uniswap V3 periphery interfaces ✅

// contracts/script/
└── DeployPumpCoreNative.s.sol # KUB Testnet deployment ✅

// contracts/test/
└── PumpCoreNative.t.sol       # Comprehensive test suite ✅
```

### Frontend (KUB Testnet ✅)

- [x] Token creation form
  - [x] Token name input
  - [x] Token symbol input
  - [x] Token description
  - [x] Token logo URL input
  - [x] Social link inputs (Website, Twitter, Telegram)
- [x] Token trading interface
  - [x] Buy/sell via bonding curve
  - [x] Price estimation with slippage protection
  - [x] Transaction status tracking with toast notifications
  - [x] ERC20 approval flow for selling
- [x] Token page
  - [x] Token info display (name, symbol, logo, creator)
  - [x] Graduation status tracker with progress bar
  - [x] Social links display
  - [x] Market info (market cap, reserves, price)
- [x] Token discovery
  - [x] Event-based token list from Creation events
  - [x] Token cards with graduation progress
  - [x] Click-through to token detail page
- [ ] Real-time price chart
- [ ] Token image upload (IPFS)

### Files to Create

```
components/launchpad/
├── launch-form.tsx           # Token creation form
├── token-trade-card.tsx      # Buy/sell bonding curve interface
├── deploy-status.tsx         # Deployment progress
└── token-page.tsx            # Deployed token page

services/
└── launchpad.ts              # PumpCoreNative contract interaction

hooks/
├── useCreateToken.ts         # Token creation
├── useBondingCurve.ts        # Buy/sell on bonding curve
└── useTokenInfo.ts           # Token data fetching

types/
└── launchpad.ts              # Launchpad types
```

### TODO

- [x] Create ERC20 token template
- [x] Create bonding curve smart contract
- [x] Create deployment scripts
- [x] Write comprehensive contract tests
- [x] Build launch-form component
- [x] Build token trading interface
- [x] Integrate contract interaction hooks
- [x] Add transaction tracking
- [ ] Test on KUB Testnet
- [ ] Security audit (before mainnet)

---

## Phase 6: Points Feature

**Duration**: 1-2 weeks
**Goal**: Implement user rewards, referral system, and gamification

### Features

- [ ] Points tracking
  - [ ] Points balance display
  - [ ] Points history (earn/spend)
  - [ ] Points earning activities
  - [ ] Real-time points update

- [ ] Referral system
  - [ ] Generate referral code
  - [ ] Referral link sharing
  - [ ] Track referred users
  - [ ] Referral rewards calculation

- [ ] Leaderboard
  - [ ] Global ranking display
  - [ ] Weekly/monthly leaderboard
  - [ ] User ranking highlight
  - [ ] Top users showcase

- [ ] Rewards redemption
  - [ ] Points to token swap
  - [ ] Exclusive features unlock
  - [ ] Badge/NFT rewards
  - [ ] Tier-based benefits

- [ ] Quest system
  - [ ] Daily/weekly quests
  - [ ] Quest completion tracking
  - [ ] Quest rewards
  - [ ] Achievement badges

### Files to Create

```
components/points/
├── points-page.tsx            # Main points page
├── points-balance.tsx         # Points display card
├── referral-card.tsx          # Referral link & stats
├── leaderboard.tsx            # Ranking table
├── quest-list.tsx             # Available quests
├── achievement-badge.tsx      # Badge display
└── history-list.tsx           # Points history

services/
└── points.ts                  # Points service (API/backend)

hooks/
├── usePoints.ts               # Points balance & history
├── useReferral.ts             # Referral system
├── useLeaderboard.ts          # Leaderboard data
└── useQuests.ts               # Quest management

types/
└── points.ts                  # Points feature types

store/
└── points-store.ts            # Points state management

app/
└── points/
    └── page.tsx               # Points page
```

### Backend Requirements

**API Endpoints:**
```typescript
GET  /api/points/balance       # Get user points
GET  /api/points/history       # Get points history
POST /api/points/earn          # Earn points from activity
POST /api/points/spend         # Spend/redeem points
GET  /api/referral/code        # Get referral code
POST /api/referral/claim       # Claim referral bonus
GET  /api/leaderboard          # Get leaderboard
GET  /api/quests               # Get available quests
POST /api/quests/complete      # Complete quest
```

**Points Earning Activities:**
| Activity | Points | Frequency |
|----------|--------|-----------|
| Swap transaction | +10 | per swap |
| Provide liquidity | +50 | per pool |
| Stake tokens | +25 | per stake |
| Daily login | +5 | daily |
| Refer a user | +100 | per referral |
| Complete quest | +20-100 | per quest |

### TODO

- [ ] Set up backend API for points
- [ ] Create database schema for points/referrals
- [ ] Build points-balance component
- [ ] Build referral-card component
- [ ] Implement leaderboard with real-time updates
- [ ] Create quest system
- [ ] Add achievement badges
- [ ] Integrate with existing features (swap, stake, etc.)
- [ ] Test points earning/redemption
- [ ] Deploy to production

---

## Phase 7: Polish & Optimization

**Duration**: 1-2 weeks
**Goal**: Production-ready features

### Performance

- [ ] Code splitting optimization
- [ ] Lazy loading for components
- [ ] Image optimization
- [ ] Bundle size reduction
- [ ] Load time optimization

### Testing

- [ ] Unit tests (Vitest)
- [ ] Integration tests
- [ ] E2E tests (Playwright)
- [ ] Contract tests
- [ ] Fuzzing tests

### Security

- [ ] Dependency audit
- [ ] Smart contract audit
- [ ] Penetration testing
- [ ] Bug bounty setup

### Analytics

- [ ] Event tracking
- [ ] Funnel analysis
- [ ] Error monitoring
- [ ] Performance monitoring

---

## Phase 8: Advanced Features (Post-MVP)

### Advanced Swap Features

- [ ] Limit orders (1inch Limit Order API)
- [ ] Portfolio view
- [ ] Transaction history

### Advanced Bridge Features

- [ ] Additional bridge providers and routes
- [ ] Bridge comparison across providers
- [ ] Route optimization for best price/speed
- [ ] KUB Chain and JB Chain bridge support

### Advanced Launchpad Features

- [ ] Vesting schedules
- [ ] Tokenomics configuration
- [ ] Fair launch mechanism
- [ ] Liquidity locking
- [ ] Anti-bot measures

### Analytics Dashboard

- [ ] Portfolio tracker
- [ ] Price charts
- [ ] Volume statistics
- [ ] User analytics
- [ ] Admin dashboard

---

## Phase 9: Subgraph & Analytics (Post-MVP)

**Duration**: 2-3 weeks
**Goal**: Implement subgraph for real-time analytics and data display

### Features

- [ ] Subgraph Setup
  - [ ] Set up The Graph node or hosted service
  - [ ] Write subgraph schema (schema.graphql)
  - [ ] Create subgraph mapping handlers
  - [ ] Deploy subgraph to supported chains

- [ ] Pool Analytics
  - [ ] Pool TVL tracking
  - [ ] Pool volume tracking
  - [ ] APY calculation
  - [ ] Historical data

- [ ] Position Analytics
  - [ ] Position history
  - [ ] Fee history
  - [ ] P&L tracking over time

- [ ] User Analytics
  - [ ] User transaction history
  - [ ] Portfolio value tracking
  - [ ] Reward history

### Files to Create

```
subgraph/
├── schema.graphql             # Subgraph schema
├── subgraph.yaml              # Subgraph manifest
└── src/
    ├── pool.ts                # Pool handlers
    ├── position.ts            # Position handlers
    ├── token.ts               # Token handlers
    └── user.ts                # User handlers

services/
└── subgraph.ts                # Subgraph query service

hooks/
├── usePoolAnalytics.ts        # Pool TVL, volume, APY
├── usePositionHistory.ts      # Position history
└── useUserHistory.ts          # User transaction history

types/
└── subgraph.ts                # Subgraph types
```

### TODO

- [ ] Set up The Graph hosted service
- [ ] Design subgraph schema for pools, positions, tokens
- [ ] Write event handlers for V3 pools
- [ ] Deploy subgraph to KUB Chain, JBC, Worldchain, Base, BSC
- [ ] Subgraph integration for dynamic incentive discovery
- [ ] Add TVL calculation to pool components
- [ ] Add volume display to pool components
- [ ] Implement APY calculation for mining pools
- [ ] Add position history modal
- [ ] Add fee history to position details
- [ ] Test subgraph queries

---

## Future Enhancements

### Mobile App

- [ ] React Native + Expo
- [ ] iOS and Android apps
- [ ] WalletConnect deep linking
- [ ] Push notifications

### Social Features

- [ ] User profiles
- [ ] Token comments
- [ ] Community voting
- [ ] Social sharing

---

## Estimated Timeline

| Phase | Duration | Start Date | Target Date | Notes |
|-------|----------|------------|-------------|-------|
| Phase 1 | ✅ Complete | - | ✅ Complete | Foundation |
| Phase 2 | ✅ Complete | - | ✅ Complete | Swap & Multi-Chain |
| Phase 3 | ✅ Complete | - | ✅ Complete | Earn Feature |
| Phase 4 | ✅ Complete | - | ✅ Complete | Bridge (LI.FI SDK) |
| Phase 5 | 2 weeks | In Progress | TBD | Launchpad (Contracts ✅, Frontend pending) |
| Phase 6 | 1-2 weeks | TBD | TBD | Points Feature |
| Phase 7 | 1-2 weeks | TBD | TBD | Polish & Optimization |
| **MVP Total** | **9-12 weeks** | **TBD** | **TBD** | |
| Phase 8 | Post-MVP | TBD | TBD | Advanced Features |
| Phase 9 | 2-3 weeks | TBD | TBD | Subgraph & Analytics |
