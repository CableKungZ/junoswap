'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNativeUsdPriceSnapshots, makePriceAt } from '@coshi190/junoswap-sdk'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import { isLeaderboardSupportedChain } from '@/lib/leaderboard-utils'
import { hasSettled } from '@/lib/query-status'
import { sanitizePricePoints } from '@/services/portfolio/net-worth-history'

export { makePriceAt }

export interface NativeUsdPricePoint {
    timestamp: number
    price: number
}

async function fetchAllSnapshots(chainId: number): Promise<NativeUsdPricePoint[]> {
    const rows = await fetchNativeUsdPriceSnapshots(ponderClient, { chainId })
    return sanitizePricePoints(
        rows.map((r) => ({ timestamp: r.timestamp, price: parseFloat(r.price) }))
    )
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
