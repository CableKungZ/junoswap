'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import {
    resolvePlatformAdapter,
    type SwapHistoryFilters,
} from '@/services/launchpad/platform-adapter'
import type { LaunchpadPlatform, SwapEventData } from '@/types/launchpad'

export type { SwapEventData }

export function useTokenSwapEvents(
    tokenAddr: Address | undefined,
    page: number = 1,
    pageSize: number = 10,
    poolAddress?: Address,
    isGraduated?: boolean,
    filters?: SwapHistoryFilters,
    market?: Address,
    platform: LaunchpadPlatform = 'junoswap'
) {
    const chainId = useLaunchpadChainId()
    const adapter = resolvePlatformAdapter(platform, isGraduated, market)

    return useQuery({
        queryKey: [
            'token-swap-events',
            chainId,
            tokenAddr?.toLowerCase(),
            page,
            pageSize,
            poolAddress?.toLowerCase(),
            isGraduated,
            filters?.isBuy,
            filters?.sender?.toLowerCase(),
            market?.toLowerCase(),
        ],
        queryFn: (): Promise<{ data: SwapEventData[]; totalCount: number }> => {
            if (!tokenAddr) return Promise.resolve({ data: [], totalCount: 0 })
            return adapter.fetchSwapHistory({
                chainId,
                tokenAddr,
                market,
                isGraduated,
                page,
                pageSize,
                filters,
            })
        },
        enabled: !!tokenAddr,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })
}
