import type { RouteQuote } from '@/types/routing'

export interface SplitAllocation {
    routeA: RouteQuote
    routeB: RouteQuote
    amountInA: bigint
    amountInB: bigint
    predictedNetOut: bigint
}

export function splitClearsMargin(
    predictedNetOut: bigint | null,
    bestSingleOut: bigint | null,
    marginBps: number
): boolean {
    if (predictedNetOut == null) return false
    if (bestSingleOut == null) return true
    return predictedNetOut * 10000n > bestSingleOut * BigInt(10000 + marginBps)
}

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
    grossA: (bigint | null)[]
    grossB: (bigint | null)[]
    bestSingleOut: bigint
    aggFeeBps: number
}

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
