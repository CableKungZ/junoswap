'use client'

import { usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import { getSplitQuote } from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import type { RouteQuote, SplitAllocation } from '@/types/routing'

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
    aggFeeBps: number
    isLoading: boolean
}

export function useSplitRoute({
    tokenIn,
    tokenOut,
    amountIn,
    allRoutes,
    enabled = true,
}: UseSplitRouteParams): UseSplitRouteResult {
    const chainId = tokenIn?.chainId ?? 0
    const client = usePublicClient({ chainId })

    const isReady = enabled && !!client && !!tokenIn && !!tokenOut && amountIn > 0n

    const query = useQuery({
        queryKey: [
            'split-quote',
            chainId,
            tokenIn?.address,
            tokenOut?.address,
            amountIn.toString(),
            allRoutes.length,
        ],
        queryFn: () =>
            getSplitQuote(client!, {
                chainId,
                tokenIn: tokenIn!.address as Address,
                tokenOut: tokenOut!.address as Address,
                amountIn,
                routes: allRoutes,
            }),
        enabled: isReady,
        staleTime: 10_000,
    })

    return {
        allocation: query.data?.allocation ?? null,
        predictedNetOut: query.data?.predictedNetOut ?? null,
        bestSingleOut: query.data?.bestSingleOut ?? null,
        aggFeeBps: query.data?.aggFeeBps ?? 0,
        isLoading: isReady && query.isLoading,
    }
}
