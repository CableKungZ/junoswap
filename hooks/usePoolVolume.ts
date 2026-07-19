'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    fetchV3PoolDayVolumes,
    computePoolVolumesUsd,
    type V3PoolDayVolumeRow,
} from '@coshi190/junoswap-sdk'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import { INTERMEDIARY_TOKENS } from '@/lib/routing-config'
import { useTokenPriceMap } from '@/hooks/useTokenPriceMap'
import type { V3PoolData } from '@/types/earn'

const SECONDS_PER_DAY = 86400

export function usePoolVolume(
    pools: V3PoolData[],
    chainId: number
): {
    volumeByAddress: Record<string, { volume1d: number; volume30d: number }>
    isLoading: boolean
} {
    const config = INTERMEDIARY_TOKENS[chainId]
    const wrappedNative = config?.wrappedNative?.toLowerCase()
    const usdStable = config?.stables[0]?.toLowerCase()

    const { priceMap, isLoading: isLoadingPrices } = useTokenPriceMap(chainId)

    const poolAddresses = useMemo(() => pools.map((p) => p.address.toLowerCase()), [pools])

    const sinceTimestamp = useMemo(() => {
        const now = Math.floor(Date.now() / 1000)
        return Math.floor(now / SECONDS_PER_DAY) * SECONDS_PER_DAY - 30 * SECONDS_PER_DAY
    }, [])

    const { data, isLoading } = useQuery({
        queryKey: ['pool-volume', poolAddresses, sinceTimestamp],
        queryFn: async (): Promise<V3PoolDayVolumeRow[]> => {
            try {
                return await fetchV3PoolDayVolumes(ponderClient, {
                    chainId,
                    poolAddresses,
                    since: sinceTimestamp,
                })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: poolAddresses.length > 0,
        staleTime: 60_000,
        refetchInterval: 60_000,
    })

    const volumeByAddress = useMemo(() => {
        if (!data) return {}
        return computePoolVolumesUsd({
            rows: data,
            pools,
            wrappedNative,
            usdStable,
            priceMap,
            nowSeconds: Math.floor(Date.now() / 1000),
        })
    }, [data, pools, wrappedNative, usdStable, priceMap])

    return { volumeByAddress, isLoading: isLoading || isLoadingPrices }
}
