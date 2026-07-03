'use client'

import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import type { Token } from '@/types/tokens'
import { useDebounce } from './useDebounce'
import { useAggregatorStore } from '@/store/aggregator-store'
import { getAggregatorProviders } from '@/lib/aggregator-config'
import { findBestRoute, type BestRouteResult } from '@/services/aggregator/best-route'
import { getSwapAddress } from '@/services/tokens'

interface UseAggregatorQuoteParams {
    tokenIn: Token | null
    tokenOut: Token | null
    amountIn: bigint
    enabled?: boolean
}

export function useAggregatorQuote({
    tokenIn,
    tokenOut,
    amountIn,
    enabled = true,
}: UseAggregatorQuoteParams) {
    const chainId = tokenIn?.chainId ?? 0
    const client = usePublicClient({ chainId })
    const { settings } = useAggregatorStore()
    const providers = getAggregatorProviders(chainId, settings.disabledDexKeys)

    // The aggregator is ERC20-only — native KUB legs quote/route through KKUB.
    const tokenInAddress = tokenIn ? getSwapAddress(tokenIn.address as Address, chainId) : undefined
    const tokenOutAddress = tokenOut
        ? getSwapAddress(tokenOut.address as Address, chainId)
        : undefined

    const debouncedAmountIn = useDebounce(amountIn, 350)

    const query = useQuery<BestRouteResult>({
        queryKey: [
            'aggregator-quote',
            chainId,
            tokenInAddress,
            tokenOutAddress,
            debouncedAmountIn.toString(),
            settings.disabledDexKeys,
        ],
        queryFn: () =>
            findBestRoute({
                client: client!,
                chainId,
                tokenIn: tokenInAddress!,
                tokenOut: tokenOutAddress!,
                amountIn: debouncedAmountIn,
                providers,
            }),
        enabled:
            enabled &&
            !!client &&
            !!tokenInAddress &&
            !!tokenOutAddress &&
            tokenInAddress.toLowerCase() !== tokenOutAddress.toLowerCase() &&
            debouncedAmountIn > 0n &&
            providers.length > 0,
        refetchInterval: 12_000,
        staleTime: 8_000,
        placeholderData: (prev) => prev, // keep last quote while refetching — no UI flicker
    })

    return {
        best: query.data?.best ?? null,
        directQuotes: query.data?.directQuotes ?? [],
        isLoading: query.isLoading || (enabled && amountIn !== debouncedAmountIn),
        isFetching: query.isFetching,
        isError: query.isError,
        error: (query.error as Error | null) ?? null,
        refetch: query.refetch,
    }
}
