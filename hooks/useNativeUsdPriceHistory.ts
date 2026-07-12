'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ponderRequest, isPonderError } from '@/lib/ponder-client'
import { isLeaderboardSupportedChain } from '@/lib/leaderboard-utils'
import { hasSettled } from '@/lib/query-status'
import { sanitizePricePoints } from '@/services/net-worth-history'

export interface NativeUsdPricePoint {
    timestamp: number
    price: number
}

interface NativeUsdPriceSnapshotsPage {
    nativeUsdPriceSnapshots: {
        pageInfo: {
            hasNextPage: boolean
            endCursor: string | null
        }
        items: Array<{
            price: string
            timestamp: number
        }>
    }
}

const PAGE_SIZE = 1000

const SNAPSHOTS_QUERY = `
  query NativeUsdPriceSnapshots($chainId: Int!, $after: String) {
    nativeUsdPriceSnapshots(
      where: { chainId: $chainId },
      orderBy: "timestamp",
      orderDirection: "asc",
      limit: ${PAGE_SIZE},
      after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      items {
        price
        timestamp
      }
    }
  }
`

async function fetchAllSnapshots(chainId: number): Promise<NativeUsdPricePoint[]> {
    const points: NativeUsdPricePoint[] = []
    let after: string | null = null

    for (;;) {
        const data: NativeUsdPriceSnapshotsPage = await ponderRequest(SNAPSHOTS_QUERY, {
            chainId,
            after,
        })
        const { pageInfo, items } = data.nativeUsdPriceSnapshots
        for (const item of items) {
            points.push({ timestamp: item.timestamp, price: parseFloat(item.price) })
        }
        if (!pageInfo.hasNextPage || !pageInfo.endCursor) break
        after = pageInfo.endCursor
    }

    return sanitizePricePoints(points)
}

export function makePriceAt(
    points: NativeUsdPricePoint[],
    fallbackPrice: number | null
): (timestamp: number) => number {
    const fallback = fallbackPrice ?? 0
    if (points.length === 0) return () => fallback

    return (timestamp: number) => {
        if (timestamp < points[0]!.timestamp) return points[0]!.price
        let lo = 0
        let hi = points.length - 1
        let ans = 0
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (points[mid]!.timestamp <= timestamp) {
                ans = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return points[ans]!.price
    }
}

export function useNativeUsdPriceHistory(chainId: number, fallbackPrice: number | null) {
    const isSupportedChain = isLeaderboardSupportedChain(chainId)

    const { data, isLoading } = useQuery({
        queryKey: ['native-usd-price-history', chainId],
        queryFn: async (): Promise<NativeUsdPricePoint[]> => {
            try {
                return await fetchAllSnapshots(chainId)
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: isSupportedChain,
        staleTime: 5 * 60_000,
    })

    const points = useMemo(() => data ?? [], [data])
    const priceAt = useMemo(() => makePriceAt(points, fallbackPrice), [points, fallbackPrice])

    return { points, priceAt, isLoading, isSettled: hasSettled(isSupportedChain, data) }
}
