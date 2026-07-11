import type { Address } from 'viem'
import type { RouteQuote } from '@/types/routing'
import { ProtocolType, getV2Config, getV3Config } from '@/lib/dex-config'
import { buildMultiHopSwapPath } from './uniswap-v2'
import { legToHops, type Leg, type ResolvedHop } from './agg-router'
import type { SplitAllocation } from './split-routing'
import type { LegCandidate } from './cross-dex-routing'

/**
 * A unified aggregator plan — the common shape a split (many single-hop legs) and a cross-DEX
 * multi-hop route (one multi-hop leg) both reduce to. One plan feeds both execution
 * (`planToLegs`) and display (`describePlan`), so neither path special-cases the candidate kind.
 */
export interface PlanLeg {
    amountIn: bigint
    hops: ResolvedHop[]
}

export interface AggregatorPlan {
    kind: 'split' | 'cross-dex'
    legs: PlanLeg[]
    /** Predicted output of the whole plan, net of the aggregator's protocol fee. */
    predictedNetOut: bigint
}

/** Resolves a single-DEX route to per-hop form (every hop shares the route's DEX/factory). */
function routeToResolvedHops(rq: RouteQuote, chainId: number): ResolvedHop[] {
    const isV3 = rq.protocolType === ProtocolType.V3
    const cfg = isV3 ? getV3Config(chainId, rq.dexId) : getV2Config(chainId, rq.dexId)
    if (!cfg?.factory) throw new Error(`no factory for ${rq.dexId} on chain ${chainId}`)
    const wnative = isV3 ? undefined : getV2Config(chainId, rq.dexId)?.wnative
    const path = buildMultiHopSwapPath(rq.route.path, chainId, wnative)

    const hops: ResolvedHop[] = []
    for (let i = 0; i < path.length - 1; i++) {
        hops.push({
            dexId: rq.dexId,
            protocol: rq.protocolType,
            factory: cfg.factory,
            tokenIn: path[i]!,
            tokenOut: path[i + 1]!,
            fee: isV3 ? rq.route.fees?.[i] : undefined,
        })
    }
    return hops
}

export function splitToPlan(allocation: SplitAllocation, chainId: number): AggregatorPlan {
    return {
        kind: 'split',
        predictedNetOut: allocation.predictedNetOut,
        legs: [
            {
                amountIn: allocation.amountInA,
                hops: routeToResolvedHops(allocation.routeA, chainId),
            },
            {
                amountIn: allocation.amountInB,
                hops: routeToResolvedHops(allocation.routeB, chainId),
            },
        ],
    }
}

export function crossDexToPlan(
    leg: LegCandidate,
    amountIn: bigint,
    aggFeeBps: number
): AggregatorPlan {
    return {
        kind: 'cross-dex',
        predictedNetOut: (leg.predictedOut * BigInt(10000 - aggFeeBps)) / 10000n,
        legs: [{ amountIn, hops: leg.hops }],
    }
}

/** The better of two candidate plans by net output; either may be null. */
export function bestPlan(
    a: AggregatorPlan | null,
    b: AggregatorPlan | null
): AggregatorPlan | null {
    if (!a) return b
    if (!b) return a
    return b.predictedNetOut > a.predictedNetOut ? b : a
}

export function planToLegs(plan: AggregatorPlan): Leg[] {
    return plan.legs.map((l) => ({ amountIn: l.amountIn, hops: legToHops(l.hops) }))
}

export interface PlanDisplayHop {
    dexId: string
    symbolIn: string
    symbolOut: string
}

export interface PlanDisplayLeg {
    /** Share of the input routed through this leg, 0–100. */
    percent: number
    hops: PlanDisplayHop[]
}

/** Per-leg display rows: share %, and each hop's DEX and token pair. */
export function describePlan(
    plan: AggregatorPlan,
    symbolOf: (token: Address) => string
): PlanDisplayLeg[] {
    const total = plan.legs.reduce((sum, l) => sum + l.amountIn, 0n)
    return plan.legs.map((l) => ({
        percent: total === 0n ? 0 : Number((l.amountIn * 10000n) / total) / 100,
        hops: l.hops.map((h) => ({
            dexId: h.dexId,
            symbolIn: symbolOf(h.tokenIn),
            symbolOut: symbolOf(h.tokenOut),
        })),
    }))
}
