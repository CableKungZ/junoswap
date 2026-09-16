'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { resolvePlatformAdapter, toHolders } from '@/services/launchpad/platform-adapter'
import type { HolderData, LaunchpadPlatform } from '@/types/launchpad'

export type { HolderData }
export { toHolders }

export function useTokenHolders(
    tokenAddr: Address | undefined,
    poolAddress?: Address,
    isGraduated?: boolean,
    market?: Address,
    platform: LaunchpadPlatform = 'junoswap'
) {
    const adapter = resolvePlatformAdapter(platform, isGraduated, market)

    const { data, isLoading } = useQuery({
        queryKey: [
            'token-holders',
            tokenAddr?.toLowerCase(),
            poolAddress?.toLowerCase(),
            isGraduated,
            market?.toLowerCase(),
        ],
        queryFn: () => {
            if (!tokenAddr) return Promise.resolve({ holders: [], holderCount: 0 })
            return adapter.fetchHolders({ tokenAddr, market })
        },
        enabled: !!tokenAddr,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    return {
        holders: data?.holders ?? [],
        holderCount: data?.holderCount ?? 0,
        isLoading,
    }
}
