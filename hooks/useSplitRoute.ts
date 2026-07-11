'use client'

import { useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import type { Address } from 'viem'
import type { Token } from '@/types/tokens'
import type { RouteQuote } from '@/types/routing'
import { ProtocolType, getV2Config, getV3Config } from '@/lib/dex-config'
import { UNISWAP_V2_ROUTER_ABI } from '@/lib/abis/uniswap-v2-router'
import { UNISWAP_V3_QUOTER_V2_ABI } from '@/lib/abis/uniswap-v3-quoter'
import { AGG_ROUTER_JUNOSWAP_ABI, getAggRouterAddress } from '@/lib/abis/agg-router-junoswap'
import { buildV2QuoteParams } from '@/services/dex/uniswap-v2'
import { getSwapAddress } from '@/services/tokens'
import {
    selectSplitCandidates,
    computeGridAmounts,
    pickBestSplit,
    type SplitAllocation,
} from '@/services/dex/split-routing'

/** routeA's share of amountIn, grid-searched. Endpoints (0/1) are the single-route cases. */
const SPLIT_FRACTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

interface UseSplitRouteParams {
    tokenIn: Token | null
    tokenOut: Token | null
    amountIn: bigint
    allRoutes: RouteQuote[]
    enabled?: boolean
}

interface UseSplitRouteResult {
    allocation: SplitAllocation | null
    predictedNetOut: bigint | null
    bestSingleOut: bigint | null
    /** The aggregator's protocol fee (bps), read once; cross-DEX plans reuse it. */
    aggFeeBps: number
    isLoading: boolean
}

type QuoteContract = {
    address: Address
    abi: typeof UNISWAP_V2_ROUTER_ABI | typeof UNISWAP_V3_QUOTER_V2_ABI
    functionName: 'getAmountsOut' | 'quoteExactInputSingle'
    args: readonly unknown[]
    chainId: number
}

/** One on-chain quote of `route` at `amount`, or null if the route's config is missing. */
function buildQuoteContract(
    route: RouteQuote,
    amount: bigint,
    tokenIn: Token,
    tokenOut: Token,
    chainId: number
): QuoteContract | null {
    if (route.protocolType === ProtocolType.V3) {
        const cfg = getV3Config(chainId, route.dexId)
        const fee = route.route.fees?.[0]
        if (!cfg?.quoter || fee == null) return null
        return {
            address: cfg.quoter,
            abi: UNISWAP_V3_QUOTER_V2_ABI,
            functionName: 'quoteExactInputSingle',
            args: [
                {
                    tokenIn: getSwapAddress(tokenIn.address as Address, chainId),
                    tokenOut: getSwapAddress(tokenOut.address as Address, chainId),
                    amountIn: amount,
                    fee,
                    sqrtPriceLimitX96: 0n,
                },
            ],
            chainId,
        }
    }
    const cfg = getV2Config(chainId, route.dexId)
    if (!cfg?.router) return null
    const { path } = buildV2QuoteParams(
        tokenIn.address as Address,
        tokenOut.address as Address,
        amount,
        chainId,
        cfg.wnative
    )
    return {
        address: cfg.router,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amount, path],
        chainId,
    }
}

function parseOut(
    route: RouteQuote,
    result: { status: 'success' | 'failure'; result?: unknown } | undefined
): bigint | null {
    if (!result || result.status !== 'success' || result.result == null) return null
    if (route.protocolType === ProtocolType.V3) {
        const out = (result.result as readonly bigint[])[0]
        return out != null && out > 0n ? out : null
    }
    const amounts = result.result as readonly bigint[]
    const out = amounts[amounts.length - 1]
    return out != null && out > 0n ? out : null
}

/**
 * Predicts the best 2-way split of `amountIn` across two distinct DEXes by quoting a grid of
 * allocations on-chain. Returns the winning allocation (net of the aggregator fee) or null when
 * no split beats routing everything through the single best DEX. The caller applies the
 * MIN_AGG_IMPROVEMENT_BPS margin before actually routing through the aggregator.
 */
export function useSplitRoute({
    tokenIn,
    tokenOut,
    amountIn,
    allRoutes,
    enabled = true,
}: UseSplitRouteParams): UseSplitRouteResult {
    const chainId = tokenIn?.chainId ?? 0
    const router = chainId ? getAggRouterAddress(chainId) : undefined

    const candidates = useMemo(() => selectSplitCandidates(allRoutes), [allRoutes])

    const grid = useMemo(() => computeGridAmounts(amountIn, SPLIT_FRACTIONS), [amountIn])

    const isReady = enabled && !!tokenIn && !!tokenOut && !!router && !!candidates && amountIn > 0n

    // Grid quotes for A at its shares, then B at its shares — results split at the midpoint.
    const contracts = useMemo(() => {
        if (!isReady || !candidates || !tokenIn || !tokenOut) return []
        const [a, b] = candidates
        const forRoute = (route: RouteQuote, amounts: bigint[]) =>
            amounts.map((amt) => buildQuoteContract(route, amt, tokenIn, tokenOut, chainId))
        const all = [...forRoute(a, grid.amountsInA), ...forRoute(b, grid.amountsInB)]
        return all.every((c) => c !== null) ? (all as QuoteContract[]) : []
    }, [isReady, candidates, tokenIn, tokenOut, chainId, grid])

    const { data: quoteResults, isLoading: isQuotesLoading } = useReadContracts({
        contracts,
        query: { enabled: isReady && contracts.length > 0, staleTime: 10_000 },
    })

    const { data: feeBpsData } = useReadContract({
        address: router,
        abi: AGG_ROUTER_JUNOSWAP_ABI,
        functionName: 'feeBps',
        chainId,
        query: { enabled: !!router },
    })

    const aggFeeBps = Number(feeBpsData ?? 0)

    const result = useMemo((): UseSplitRouteResult => {
        const empty = {
            allocation: null,
            predictedNetOut: null,
            bestSingleOut: null,
            aggFeeBps,
            isLoading: isQuotesLoading,
        }
        if (!candidates || !quoteResults) return empty

        const n = grid.amountsInA.length
        const [a, b] = candidates
        const grossA = grid.amountsInA.map((_, i) => parseOut(a, quoteResults[i]))
        const grossB = grid.amountsInB.map((_, i) => parseOut(b, quoteResults[n + i]))
        const bestSingleOut = a.quote.amountOut

        const allocation = pickBestSplit({
            candidateA: a,
            candidateB: b,
            amountsInA: grid.amountsInA,
            amountsInB: grid.amountsInB,
            grossA,
            grossB,
            bestSingleOut,
            aggFeeBps,
        })

        return {
            allocation,
            predictedNetOut: allocation?.predictedNetOut ?? null,
            bestSingleOut,
            aggFeeBps,
            isLoading: isQuotesLoading,
        }
    }, [candidates, quoteResults, grid, aggFeeBps, isQuotesLoading])

    return result
}
