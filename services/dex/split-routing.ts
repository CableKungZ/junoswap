import type { RouteQuote } from '@/types/routing'

/**
 * Splits a swap across two DEXes via the aggregation router. Outputs are predicted by quoting
 * each leg on-chain (not local AMM math); because two direct routes on distinct DEXes use
 * disjoint pools, the per-leg quotes sum to the exact on-chain split result.
 */

export interface SplitAllocation {
    routeA: RouteQuote
    routeB: RouteQuote
    amountInA: bigint
    amountInB: bigint
    /** Predicted output of the whole split, net of the aggregator's protocol fee. */
    predictedNetOut: bigint
}

/**
 * True when a split's predicted output clears the single-route baseline by `marginBps`. Shared by
 * the swap card (gates execution) and the DEX selector (labels the header) so the two never drift.
 */
export function splitClearsMargin(
    predictedNetOut: bigint | null,
    bestSingleOut: bigint | null,
    marginBps: number
): boolean {
    if (predictedNetOut == null || bestSingleOut == null) return false
    return predictedNetOut * 10000n > bestSingleOut * BigInt(10000 + marginBps)
}

/**
 * Best direct route per DEX, top two by single-route output. Direct routes on distinct DEXes are
 * pool-disjoint by construction, which is what lets the grid predictions be summed exactly.
 * Returns null when fewer than two DEXes have a direct route.
 */
export function selectSplitCandidates(allRoutes: RouteQuote[]): [RouteQuote, RouteQuote] | null {
    const bestPerDex = new Map<string, RouteQuote>()
    for (const r of allRoutes) {
        if (r.route.isMultiHop) continue
        const cur = bestPerDex.get(r.dexId)
        if (!cur || r.quote.amountOut > cur.quote.amountOut) bestPerDex.set(r.dexId, r)
    }

    const sorted = [...bestPerDex.values()].sort((a, b) =>
        b.quote.amountOut > a.quote.amountOut ? 1 : b.quote.amountOut < a.quote.amountOut ? -1 : 0
    )
    if (sorted.length < 2) return null
    return [sorted[0]!, sorted[1]!]
}

/**
 * Exact integer leg amounts for each interior fraction `f` (routeA's share). `legB = amt - legA`,
 * so the pair always sums to `amountIn` with no dust — required by the router's `sum == amountIn`
 * check. Fractions are taken as permille to stay exact.
 */
export function computeGridAmounts(
    amountIn: bigint,
    fractions: number[]
): { amountsInA: bigint[]; amountsInB: bigint[] } {
    const amountsInA: bigint[] = []
    const amountsInB: bigint[] = []
    for (const f of fractions) {
        const permille = BigInt(Math.round(f * 1000))
        const a = (amountIn * permille) / 1000n
        amountsInA.push(a)
        amountsInB.push(amountIn - a)
    }
    return { amountsInA, amountsInB }
}

export interface SplitQuoteGrid {
    candidateA: RouteQuote
    candidateB: RouteQuote
    amountsInA: bigint[]
    amountsInB: bigint[]
    /** Gross output of routeA at amountsInA[i]; null where the leg failed to quote. */
    grossA: (bigint | null)[]
    /** Gross output of routeB at amountsInB[i]. */
    grossB: (bigint | null)[]
    /** Best single-route output at the full amount — the baseline a split must beat. */
    bestSingleOut: bigint
    aggFeeBps: number
}

/**
 * Picks the interior allocation with the highest net output, or null if none beats routing the
 * whole amount through the single best DEX. The `MIN_AGG_IMPROVEMENT_BPS` margin is applied later
 * by the gate; here the baseline is a plain strict improvement.
 */
export function pickBestSplit(g: SplitQuoteGrid): SplitAllocation | null {
    const feeMul = BigInt(10000 - g.aggFeeBps)
    let best: SplitAllocation | null = null

    for (let i = 0; i < g.amountsInA.length; i++) {
        const qa = g.grossA[i]
        const qb = g.grossB[i]
        if (qa == null || qb == null) continue
        if (g.amountsInA[i]! <= 0n || g.amountsInB[i]! <= 0n) continue

        const net = ((qa + qb) * feeMul) / 10000n
        if (net <= g.bestSingleOut) continue
        if (!best || net > best.predictedNetOut) {
            best = {
                routeA: g.candidateA,
                routeB: g.candidateB,
                amountInA: g.amountsInA[i]!,
                amountInB: g.amountsInB[i]!,
                predictedNetOut: net,
            }
        }
    }
    return best
}
