'use client'

import { usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import { getCrossDexQuote, type CrossDexLeg } from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import { getIntermediaryTokens } from '@/lib/routing-config'

interface UseCrossDexRouteParams {
    tokenIn: Token | null
    tokenOut: Token | null
    amountIn: bigint
    enabled?: boolean
}

interface UseCrossDexRouteResult {
    leg: CrossDexLeg | null
    isLoading: boolean
}

export function useCrossDexRoute({
    tokenIn,
    tokenOut,
    amountIn,
    enabled = true,
}: UseCrossDexRouteParams): UseCrossDexRouteResult {
    const chainId = tokenIn?.chainId ?? 0
    const client = usePublicClient({ chainId })

    const isReady = enabled && !!client && !!tokenIn && !!tokenOut && amountIn > 0n

    const query = useQuery({
        queryKey: [
            'cross-dex-quote',
            chainId,
            tokenIn?.address,
            tokenOut?.address,
            amountIn.toString(),
        ],
        queryFn: () =>
            getCrossDexQuote(client!, {
                chainId,
                tokenIn: tokenIn!.address as Address,
                tokenOut: tokenOut!.address as Address,
                amountIn,
                connectors: getIntermediaryTokens(chainId),
            }),
        enabled: isReady,
        staleTime: 10_000,
    })

    return {
        leg: query.data ?? null,
        isLoading: isReady && query.isLoading,
    }
}
