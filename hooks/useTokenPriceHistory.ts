'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatEther, type Address } from 'viem'
import { fetchBondingCurveHistory, fetchV3History } from '@coshi190/juno-moneta-sdk'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import { INTERMEDIARY_TOKENS } from '@/lib/routing-config'
import { ponderClient } from '@/lib/ponder-client'
import { fetchDurianfunMarketSwaps } from '@/services/launchpad/durianfun'
import { TOTAL_SUPPLY } from '@/lib/launchpad-curve'
import {
    aggregateCandlesticks,
    aggregatePricePoints,
    aggregateV3Candlesticks,
    computeFeeBreakdown,
    extractCreatorTrades,
    stitchCandlesticks,
} from '@/services/launchpad/chart'
import type { PricePoint, V3SwapEvent } from '@/services/launchpad/chart'
import type { Timeframe, ChartMode } from '@/types/chart'

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

export function useTokenPriceHistory(
    tokenAddr: Address | undefined,
    isGraduated?: boolean,
    graduatedAt?: number | null,
    creatorAddress?: Address,
    // Non-graduated Durianfun tokens aren't indexed by ponder -- their price history is
    // derived from the market's own swap events instead, read straight from chain.
    // Deliberately NOT routed through services/launchpad/platform-adapter.ts like
    // useTokenSwapEvents/useTokenHolders: Junoswap's own candles use per-swap open/high/low
    // computed from computeCurve (real gap-filling, volume bars), which aggregatePricePoints
    // can't reproduce without losing quality -- a shared adapter interface here would mean
    // either regressing Junoswap's chart or building a second aggregation path anyway.
    durianfunMarket?: Address
) {
    const [timeframe, setTimeframe] = useState<Timeframe>('15m')
    const [chartMode, setChartMode] = useState<ChartMode>('mcap')
    const chainId = useLaunchpadChainId()
    const wrappedNative = INTERMEDIARY_TOKENS[chainId]?.wrappedNative

    const tokenIsToken0 = tokenAddr
        ? tokenAddr.toLowerCase() < (wrappedNative?.toLowerCase() ?? '')
        : false

    const {
        data: rawEvents,
        isLoading: isLoadingBc,
        refetch,
    } = useQuery({
        queryKey: ['token-price-history', tokenAddr?.toLowerCase()],
        queryFn: async () => {
            if (!tokenAddr) return []

            const items = await fetchBondingCurveHistory(ponderClient, {
                tokenAddr: tokenAddr.toLowerCase(),
            })

            return items.map((e) => ({
                timestamp: e.timestamp,
                isBuy: e.isBuy === 1,
                amountIn: BigInt(e.amountIn),
                amountOut: BigInt(e.amountOut),
                reserveIn: BigInt(e.reserveIn),
                reserveOut: BigInt(e.reserveOut),
                sender: e.sender,
            }))
        },
        enabled: !!tokenAddr && !durianfunMarket,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    const { data: durianfunPricePoints, isLoading: isLoadingDurianfun } = useQuery({
        queryKey: ['durianfun-price-history', durianfunMarket?.toLowerCase()],
        queryFn: async (): Promise<PricePoint[]> => {
            if (!durianfunMarket) return []
            const swaps = await fetchDurianfunMarketSwaps(durianfunMarket)
            return swaps
                .map((s) => {
                    const nativeAmount = s.isBuy ? s.amountIn : s.amountOut
                    const tokenAmount = s.isBuy ? s.amountOut : s.amountIn
                    if (tokenAmount === 0n) return null
                    return {
                        timestamp: s.timestamp,
                        price:
                            parseFloat(formatEther(nativeAmount)) /
                            parseFloat(formatEther(tokenAmount)),
                        volume: parseFloat(formatEther(nativeAmount)),
                    }
                })
                .filter((p): p is NonNullable<typeof p> => p !== null)
                .sort((a, b) => a.timestamp - b.timestamp)
        },
        enabled: !!durianfunMarket,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    const { data: rawV3Events, isLoading: isLoadingV3 } = useQuery({
        queryKey: ['token-v3-price-history', tokenAddr?.toLowerCase(), chainId],
        queryFn: async () => {
            if (!tokenAddr) return []

            try {
                const items = await fetchV3History(ponderClient, {
                    tokenAddr: tokenAddr.toLowerCase(),
                    chainId,
                })

                return items.map((e) => ({
                    timestamp: e.timestamp,
                    amount0: e.amount0,
                    amount1: e.amount1,
                    sqrtPriceX96: e.sqrtPriceX96,
                    tick: e.tick,
                    txFrom: e.txFrom,
                    tokenIsToken0: e.tokenIsToken0,
                }))
            } catch {
                return []
            }
        },
        enabled: !!tokenAddr && !!isGraduated,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    const data = useMemo(() => {
        if (durianfunMarket) {
            const points = durianfunPricePoints ?? []
            const scaled =
                chartMode === 'mcap'
                    ? points.map((p) => ({ ...p, price: p.price * TOTAL_SUPPLY }))
                    : points
            return aggregatePricePoints(scaled, timeframe)
        }

        const bcCandles = aggregateCandlesticks(rawEvents ?? [], timeframe, chartMode)

        if (isGraduated) {
            const v3Candles = aggregateV3Candlesticks(
                (rawV3Events ?? []) as V3SwapEvent[],
                timeframe,
                chartMode,
                tokenIsToken0
            )
            return stitchCandlesticks(bcCandles, v3Candles, graduatedAt ?? null)
        }

        return bcCandles
    }, [
        rawEvents,
        rawV3Events,
        durianfunMarket,
        durianfunPricePoints,
        timeframe,
        chartMode,
        isGraduated,
        tokenIsToken0,
        graduatedAt,
    ])

    const feeBreakdown = useMemo(() => computeFeeBreakdown(rawEvents ?? []), [rawEvents])

    const creatorTrades = useMemo(
        () =>
            creatorAddress
                ? extractCreatorTrades(
                      rawEvents ?? [],
                      rawV3Events ?? [],
                      creatorAddress,
                      graduatedAt ?? null
                  )
                : [],
        [rawEvents, rawV3Events, creatorAddress, graduatedAt]
    )

    return {
        data,
        feeBreakdown,
        creatorTrades,
        isLoading: durianfunMarket
            ? isLoadingDurianfun
            : isLoadingBc || (isGraduated && isLoadingV3),
        timeframe,
        setTimeframe,
        chartMode,
        setChartMode,
        refetch,
    }
}
