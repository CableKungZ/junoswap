'use client'

import { useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { ponderRequest, fetchAllPages } from '@/lib/ponder-client'
import { RANGE_CHART_WINDOW_SEC } from '@/services/position-chart'
import type { PoolSwapPoint } from '@/services/position-chart'

const PAGE_SIZE = 1000

const POOL_SWAPS_QUERY = `
  query PoolPriceHistory($poolAddress: String!, $chainId: Int!, $since: Int!, $after: String) {
    v3SwapEvents(
      where: { poolAddress: $poolAddress, chainId: $chainId, timestamp_gt: $since }
      orderBy: "timestamp", orderDirection: "asc", limit: ${PAGE_SIZE}, after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      items { timestamp sqrtPriceX96 }
    }
  }
`

const POOL_ANCHOR_QUERY = `
  query PoolPriceAnchor($poolAddress: String!, $chainId: Int!, $before: Int!) {
    v3SwapEvents(
      where: { poolAddress: $poolAddress, chainId: $chainId, timestamp_lte: $before }
      orderBy: "timestamp", orderDirection: "desc", limit: 1
    ) {
      items { timestamp sqrtPriceX96 }
    }
  }
`

interface PoolSwapsResponse {
    v3SwapEvents: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        items: PoolSwapPoint[]
    }
}

interface PoolAnchorResponse {
    v3SwapEvents: { items: PoolSwapPoint[] }
}

export interface PoolPriceHistory {
    events: PoolSwapPoint[]
    anchor: PoolSwapPoint | null
    isLoading: boolean
}

export function usePoolPriceHistory(poolAddress: Address | undefined): PoolPriceHistory {
    const chainId = useChainId()

    const { data, isLoading } = useQuery({
        queryKey: ['pool-price-history', chainId, poolAddress?.toLowerCase()],
        queryFn: async () => {
            const pool = poolAddress!.toLowerCase()
            const since = Math.floor(Date.now() / 1000) - RANGE_CHART_WINDOW_SEC
            const [events, anchor] = await Promise.all([
                fetchAllPages<PoolSwapsResponse, PoolSwapPoint>(
                    POOL_SWAPS_QUERY,
                    { poolAddress: pool, chainId, since },
                    (r) => r.v3SwapEvents
                ).catch(() => [] as PoolSwapPoint[]),
                ponderRequest<PoolAnchorResponse>(POOL_ANCHOR_QUERY, {
                    poolAddress: pool,
                    chainId,
                    before: since,
                })
                    .then((r) => r.v3SwapEvents.items[0] ?? null)
                    .catch(() => null),
            ])
            return { events, anchor }
        },
        enabled: !!poolAddress,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    return {
        events: data?.events ?? [],
        anchor: data?.anchor ?? null,
        isLoading,
    }
}
