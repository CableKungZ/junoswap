'use client'

import { useMemo } from 'react'
import { usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import {
    ProtocolType,
    computePriceImpactPercent,
    getRoutePriceImpact,
} from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import type { RouteQuote } from '@/types/routing'
import { getWrapOperation } from '@/lib/tokens'

export { computePriceImpactPercent }

interface UseRoutePriceImpactParams {
    route: RouteQuote | null
    tokenIn: Token | null
    tokenOut: Token | null
    amountIn: bigint
    enabled?: boolean
}

interface UseRoutePriceImpactResult {
    priceImpact: number | undefined
    isLoading: boolean
}

export function useRoutePriceImpact({
    route,
    tokenIn,
    tokenOut,
    amountIn,
    enabled = true,
}: UseRoutePriceImpactParams): UseRoutePriceImpactResult {
    const chainId = tokenIn?.chainId ?? tokenOut?.chainId ?? 1
    const client = usePublicClient({ chainId })
    const wrapOperation = useMemo(() => getWrapOperation(tokenIn, tokenOut), [tokenIn, tokenOut])

    const isV3 = route?.protocolType === ProtocolType.V3 && !!route.route.fees
    const isV2 = route?.protocolType === ProtocolType.V2

    const isReady =
        enabled &&
        !!route &&
        !!client &&
        !wrapOperation &&
        (isV3 || isV2) &&
        route.route.path.length >= 2 &&
        amountIn > 0n

    const query = useQuery({
        queryKey: [
            'route-price-impact',
            chainId,
            route?.dexId,
            route?.protocolType,
            route?.route.path,
            route?.route.fees,
            amountIn.toString(),
            route?.quote.amountOut.toString(),
        ],
        queryFn: () => {
            const path = route!.route.path
            return getRoutePriceImpact(client!, {
                chainId,
                protocol: route!.protocolType,
                dexId: route!.dexId,
                path,
                fees: route!.route.fees,
                amountIn,
                fullAmountOut: route!.quote.amountOut,
            })
        },
        enabled: isReady,
        staleTime: 0,
    })

    return {
        priceImpact: query.data ?? undefined,
        isLoading: isReady && query.isLoading,
    }
}
