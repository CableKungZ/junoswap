'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { Address } from 'viem'
import {
    fetchBondingCurvePricesSince,
    fetchV3PricesSince,
    fetchTokenV3Swaps,
    computeCurve,
} from '@coshi190/juno-moneta-sdk'
import { computePoolPrice } from '@/lib/tick-math'
import { TOTAL_SUPPLY } from '@/lib/launchpad-curve'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import {
    aggregatePricePoints,
    computeDailyMetrics,
    type PricePoint,
} from '@/services/launchpad/chart'

const DAY_SECONDS = 86400

export interface GraduatedTokenActivity {
    lastSwapAt: number
    priceChange1dPct: number | null
    marketCap: number | null
}

export interface GraduatedTokenInput {
    address: Address
    graduatedAt: number | null
}

// The indexer's TokenSnapshot aggregate can stall after graduation on some chains (it never
// re-syncs from post-graduation V3 swaps), so lastSwapAt/priceChange1dPct are recomputed here
// straight from the raw bonding-curve + V3 swap tables instead — the same tables the token detail
// chart already reads, stitched across the graduation boundary the same way.
async function fetchTokenActivity(
    tokenAddr: string,
    chainId: number,
    graduatedAt: number | null,
    since: number
): Promise<GraduatedTokenActivity> {
    try {
        // Querying v3Points from exactly `since` (the same cutoff computeDailyMetrics uses for
        // "24h ago") leaves no point *before* the cutoff to anchor against -- a token with a
        // single trade inside the window then has priceThen === priceNow, always reading 0%. Look
        // further back (capped at 30 days, or graduation if more recent) so a real anchor exists;
        // computeDailyMetrics still only counts volume/change within the actual 24h window.
        const historyStart = Math.max(graduatedAt ?? 0, since - DAY_SECONDS * 29)
        const v3Points = await fetchV3PricesSince(ponderClient, {
            tokenAddr,
            chainId,
            since: historyStart,
        })
        const points: PricePoint[] = v3Points.map((e) => ({
            timestamp: e.timestamp,
            price: computePoolPrice({
                sqrtPriceX96: BigInt(e.sqrtPriceX96),
                decimals0: 18,
                decimals1: 18,
                invert: e.tokenIsToken0 !== 1,
            }),
        }))

        if (graduatedAt !== null && graduatedAt >= since) {
            const bcPoints = await fetchBondingCurvePricesSince(ponderClient, { tokenAddr, since })
            for (const e of bcPoints) {
                if (e.timestamp >= graduatedAt) continue
                points.push({
                    timestamp: e.timestamp,
                    price: computeCurve({
                        nativeReserve: e.isBuy === 1 ? BigInt(e.reserveIn) : BigInt(e.reserveOut),
                        tokenReserve: e.isBuy === 1 ? BigInt(e.reserveOut) : BigInt(e.reserveIn),
                    }).price,
                })
            }
            points.sort((a, b) => a.timestamp - b.timestamp)
        }

        const metrics = computeDailyMetrics(aggregatePricePoints(points, '1h'), null)

        const latest = await fetchTokenV3Swaps(ponderClient, {
            tokenAddr,
            chainId,
            limit: 1,
            offset: 0,
        })
        const latestSwap = latest.items[0]
        const lastSwapAt = latestSwap?.timestamp ?? graduatedAt ?? 0

        // The most recent swap's own sqrtPriceX96 is the live price regardless of whether it
        // falls inside the `since` (1d) window used for priceChange1dPct above -- so a token with
        // no trades in the last 24h still gets its real last-known price instead of nothing.
        const marketCap = latestSwap
            ? computePoolPrice({
                  sqrtPriceX96: BigInt(latestSwap.sqrtPriceX96),
                  decimals0: 18,
                  decimals1: 18,
                  invert: latestSwap.tokenIsToken0 !== 1,
              }) * TOTAL_SUPPLY
            : null

        return { lastSwapAt, priceChange1dPct: metrics?.priceChange1dPct ?? null, marketCap }
    } catch (e) {
        if (isPonderError(e))
            return { lastSwapAt: graduatedAt ?? 0, priceChange1dPct: null, marketCap: null }
        throw e
    }
}

/** Live lastSwapAt/priceChange1dPct for graduated tokens, keyed by lowercased address. */
export function useGraduatedTokenActivity(
    tokens: GraduatedTokenInput[],
    chainId: number
): Map<string, GraduatedTokenActivity> {
    const since = useMemo(() => Math.floor(Date.now() / 60_000) * 60 - DAY_SECONDS, [])

    const queries = useQueries({
        queries: tokens.map((t) => ({
            queryKey: ['graduated-token-activity', chainId, t.address.toLowerCase(), since],
            queryFn: () =>
                fetchTokenActivity(t.address.toLowerCase(), chainId, t.graduatedAt, since),
            staleTime: 30_000,
            refetchInterval: 30_000,
        })),
    })

    return useMemo(() => {
        const map = new Map<string, GraduatedTokenActivity>()
        tokens.forEach((t, i) => {
            const data = queries[i]?.data
            if (data) map.set(t.address.toLowerCase(), data)
        })
        return map
    }, [tokens, queries])
}
