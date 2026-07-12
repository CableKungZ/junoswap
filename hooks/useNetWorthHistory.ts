'use client'

import { useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { ponderRequest, isPonderError } from '@/lib/ponder-client'
import { isLeaderboardSupportedChain } from '@/lib/leaderboard-utils'
import { isNativeToken } from '@/lib/wagmi'
import { INTERMEDIARY_TOKENS } from '@/lib/routing-config'
import { isStablecoin } from '@/hooks/useTokenPrices'
import { calculatePrice, calculatePriceFromSqrtPrice } from '@/services/chart'
import {
    buildLedgerNetWorthSeries,
    type BalanceDelta,
    type LedgerToken,
    type PriceKind,
} from '@/services/net-worth-ledger'
import { DAY_SECONDS, type NetWorthPoint, type PricePoint } from '@/services/net-worth-history'
import type { UserSwapEvent } from '@/hooks/useUserSwapEvents'
import type { PortfolioToken, TokenType } from '@/types/portfolio'

const PAGE_LIMIT = 1000

const EMPTY_HISTORY: NetWorthPoint[] = []

const BONDING_PRICE_QUERY = `
  query LedgerBondingPrices($tokenAddr: String!, $since: Int!) {
    swapEvents(
      where: { tokenAddr: $tokenAddr, timestamp_gte: $since },
      orderBy: "timestamp", orderDirection: "asc", limit: ${PAGE_LIMIT}
    ) {
      items { timestamp isBuy reserveIn reserveOut }
    }
  }
`

const V3_PRICE_QUERY = `
  query LedgerV3Prices($tokenAddr: String!, $chainId: Int!, $since: Int!) {
    v3SwapEvents(
      where: { tokenAddr: $tokenAddr, chainId: $chainId, timestamp_gte: $since },
      orderBy: "timestamp", orderDirection: "asc", limit: ${PAGE_LIMIT}
    ) {
      items { timestamp sqrtPriceX96 tokenIsToken0 }
    }
  }
`

interface BondingPriceResponse {
    swapEvents: {
        items: Array<{ timestamp: number; isBuy: number; reserveIn: string; reserveOut: string }>
    }
}

interface V3PriceResponse {
    v3SwapEvents: {
        items: Array<{ timestamp: number; sqrtPriceX96: string; tokenIsToken0: number }>
    }
}

async function fetchNativePricePoints(
    tokenAddr: string,
    chainId: number,
    tokenType: TokenType,
    since: number
): Promise<PricePoint[]> {
    try {
        if (tokenType === 'bonding_curve') {
            const data = await ponderRequest<BondingPriceResponse>(BONDING_PRICE_QUERY, {
                tokenAddr,
                since,
            })
            return data.swapEvents.items.map((e) => ({
                timestamp: e.timestamp,
                price: calculatePrice({
                    timestamp: e.timestamp,
                    isBuy: e.isBuy === 1,
                    amountIn: 0n,
                    amountOut: 0n,
                    reserveIn: BigInt(e.reserveIn),
                    reserveOut: BigInt(e.reserveOut),
                }),
            }))
        }

        const data = await ponderRequest<V3PriceResponse>(V3_PRICE_QUERY, {
            tokenAddr,
            chainId,
            since,
        })
        return data.v3SwapEvents.items.map((e) => ({
            timestamp: e.timestamp,
            price: calculatePriceFromSqrtPrice(BigInt(e.sqrtPriceX96), e.tokenIsToken0 === 1),
        }))
    } catch (e) {
        if (isPonderError(e)) return []
        throw e
    }
}

function classify(token: PortfolioToken['token'], chainId: number): PriceKind {
    if (isNativeToken(token.address)) return 'native'
    const wrapped = INTERMEDIARY_TOKENS[chainId]?.wrappedNative
    if (wrapped && token.address.toLowerCase() === wrapped.toLowerCase()) return 'native'
    if (isStablecoin(token)) return 'stable'
    return 'reconstructed'
}

interface UseNetWorthHistoryParams {
    address: `0x${string}` | undefined
    chainId: number
    portfolioTokens: PortfolioToken[]
    swapEvents: UserSwapEvent[] | undefined
    nativeUsdPoints: PricePoint[]
    nativeUsdPrice: number | null
    netWorthNow: number
    /** Balances, spot prices, swap history and native-USD points still resolving. */
    isInputLoading: boolean
}

export function useNetWorthHistory(params: UseNetWorthHistoryParams): NetWorthPoint[] {
    const { address, chainId, portfolioTokens, swapEvents, nativeUsdPoints, nativeUsdPrice } =
        params

    const supported = isLeaderboardSupportedChain(chainId)

    const nowSec = useMemo(() => Math.floor(Date.now() / 60_000) * 60, [])
    const windowStart = nowSec - DAY_SECONDS

    const classified = useMemo(
        () =>
            portfolioTokens.map((t) => ({
                pt: t,
                kind: classify(t.token, chainId),
            })),
        [portfolioTokens, chainId]
    )

    const reconstructable = useMemo(
        () => classified.filter((c) => c.kind === 'reconstructed'),
        [classified]
    )

    const priceQueries = useQueries({
        queries: reconstructable.map((c) => ({
            queryKey: [
                'nw-native-price',
                chainId,
                c.pt.token.address.toLowerCase(),
                c.pt.tokenType,
                windowStart,
            ],
            queryFn: () =>
                fetchNativePricePoints(
                    c.pt.token.address.toLowerCase(),
                    chainId,
                    c.pt.tokenType,
                    windowStart
                ),
            enabled: supported,
            staleTime: 60_000,
        })),
    })

    const arePricesLoading = supported && priceQueries.some((q) => q.data === undefined)

    const nativePriceByToken = useMemo(() => {
        const map = new Map<string, PricePoint[]>()
        reconstructable.forEach((c, i) => {
            map.set(c.pt.token.address.toLowerCase(), priceQueries[i]?.data ?? [])
        })
        return map
    }, [reconstructable, priceQueries])

    const { deltasByToken, nativeDeltas } = useMemo(() => {
        const byToken = new Map<string, UserSwapEvent[]>()
        const nativeLeg: BalanceDelta[] = []
        for (const e of swapEvents ?? []) {
            if (e.timestamp < windowStart || e.timestamp >= nowSec) continue
            const key = e.tokenAddr.toLowerCase()
            const list = byToken.get(key) ?? []
            list.push(e)
            byToken.set(key, list)
            const native = parseFloat(formatUnits(BigInt(e.isBuy ? e.amountIn : e.amountOut), 18))
            nativeLeg.push({ timestamp: e.timestamp, delta: e.isBuy ? -native : native })
        }
        const decoded = new Map<string, BalanceDelta[]>()
        for (const c of classified) {
            const key = c.pt.token.address.toLowerCase()
            const raw = byToken.get(key)
            if (!raw) continue
            const decimals = c.pt.token.decimals
            decoded.set(
                key,
                raw.map((e) => {
                    const tokenRaw = e.isBuy ? e.amountOut : e.amountIn
                    const tokens = parseFloat(formatUnits(BigInt(tokenRaw), decimals))
                    return { timestamp: e.timestamp, delta: e.isBuy ? tokens : -tokens }
                })
            )
        }
        return { deltasByToken: decoded, nativeDeltas: nativeLeg }
    }, [swapEvents, classified, windowStart, nowSec])

    const nativeTargetKey = useMemo(() => {
        const nativeCoin = classified.find((c) => isNativeToken(c.pt.token.address))
        const target = nativeCoin ?? classified.find((c) => c.kind === 'native')
        return target?.pt.token.address.toLowerCase() ?? null
    }, [classified])

    const isSettling = params.isInputLoading || arePricesLoading

    const series = useMemo(() => {
        if (!address || !supported || nativeUsdPrice === null || isSettling) return null

        const tokens: LedgerToken[] = classified.map((c) => {
            const key = c.pt.token.address.toLowerCase()
            const deltas = deltasByToken.get(key) ?? []
            return {
                currentBalance: parseFloat(c.pt.formattedBalance) || 0,
                deltas: key === nativeTargetKey ? [...deltas, ...nativeDeltas] : deltas,
                priceKind: c.kind,
                nativePricePoints: nativePriceByToken.get(key) ?? [],
                priceUsdNow: c.pt.priceUsd ?? 0,
            }
        })

        return buildLedgerNetWorthSeries({
            tokens,
            nativeUsdPoints,
            nativeUsdNow: nativeUsdPrice,
            windowStart,
            nowSec,
            netWorthNow: params.netWorthNow,
        })
    }, [
        address,
        supported,
        nativeUsdPrice,
        isSettling,
        classified,
        deltasByToken,
        nativeDeltas,
        nativeTargetKey,
        nativePriceByToken,
        nativeUsdPoints,
        windowStart,
        nowSec,
        params.netWorthNow,
    ])

    const scope = `${chainId}:${address?.toLowerCase() ?? ''}`
    const cacheRef = useRef<{ scope: string; series: NetWorthPoint[] } | null>(null)
    if (cacheRef.current && cacheRef.current.scope !== scope) cacheRef.current = null
    if (series) cacheRef.current = { scope, series }

    return cacheRef.current?.series ?? EMPTY_HISTORY
}
