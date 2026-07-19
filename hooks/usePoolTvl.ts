'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { computePoolTvlUsd, fetchV3PoolReserves, type PoolBalances } from '@coshi190/junoswap-sdk'
import type { V3PoolData } from '@/types/earn'
import { INTERMEDIARY_TOKENS } from '@/lib/routing-config'
import { useTokenPriceMap } from '@/hooks/useTokenPriceMap'
import { ponderClient, isPonderError } from '@/lib/ponder-client'

const MAX_POOLS = 200

export function usePoolTvl(
    pools: V3PoolData[],
    chainId: number
): {
    tvlByAddress: Record<string, number | null>
    isLoading: boolean
} {
    const cappedPools = pools.length > MAX_POOLS ? pools.slice(0, MAX_POOLS) : pools

    const config = INTERMEDIARY_TOKENS[chainId]
    const wrappedNative = config?.wrappedNative?.toLowerCase()
    const usdStable = config?.stables[0]?.toLowerCase()

    const { priceMap, isLoading: isLoadingPrices } = useTokenPriceMap(chainId)

    const poolAddresses = useMemo(
        () => cappedPools.map((p) => p.address.toLowerCase()),
        [cappedPools]
    )

    const { data: reserveRows, isLoading: isLoadingReserves } = useQuery({
        queryKey: ['pool-reserves', chainId, poolAddresses],
        queryFn: async () => {
            try {
                return await fetchV3PoolReserves(ponderClient, { chainId, poolAddresses })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: poolAddresses.length > 0,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    const indexedReserves = useMemo(() => {
        const map = new Map<string, PoolBalances>()
        for (const r of reserveRows ?? []) {
            map.set(r.poolAddress.toLowerCase(), {
                balance0: BigInt(r.reserve0),
                balance1: BigInt(r.reserve1),
            })
        }
        return map
    }, [reserveRows])

    const isLoading = isLoadingPrices || isLoadingReserves

    const tvlByAddress = useMemo(() => {
        if (cappedPools.length === 0) return {}

        return computePoolTvlUsd({
            pools: cappedPools,
            balances: indexedReserves,
            wrappedNative,
            usdStable,
            priceMap,
        })
    }, [indexedReserves, cappedPools, wrappedNative, usdStable, priceMap])

    return { tvlByAddress, isLoading }
}
