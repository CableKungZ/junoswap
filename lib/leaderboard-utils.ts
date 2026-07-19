import { kubTestnet, bitkub, jbc } from '@/lib/wagmi'
import {
    fetchBondingCurveSwaps,
    fetchV3Swaps,
    fetchV2Swaps,
    wrappedNativeFor,
} from '@/lib/swap-events'
import { ponderClient } from '@/lib/ponder-client'
import {
    computePoints,
    computeReferralPoints,
    aggregatePointsByAddress,
    toRow,
    fetchSwapEventsForSenders as sdkFetchSwapEventsForSenders,
    type SwapEventRow,
    type TraderAgg,
} from '@coshi190/junoswap-sdk'
import type { LeaderboardTimePeriod } from '@/types/leaderboard'

// Points math + row types now live in the SDK; re-exported here so existing app imports are stable.
export { computePoints, computeReferralPoints, aggregatePointsByAddress }
export type { SwapEventRow, TraderAgg }

const LEADERBOARD_SUPPORTED_CHAINS = new Set<number>([kubTestnet.id, bitkub.id, jbc.id])

export function isLeaderboardSupportedChain(chainId: number): boolean {
    return LEADERBOARD_SUPPORTED_CHAINS.has(chainId)
}

export function getTimeThreshold(period: LeaderboardTimePeriod): number {
    if (period === 'all') return 0
    const now = Math.floor(Date.now() / 1000)
    switch (period) {
        case '24h':
            return now - 86400
        case '7d':
            return now - 604800
        case '30d':
            return now - 2592000
    }
}

export async function fetchSwapEvents(
    chainId: number,
    sinceTimestamp: number
): Promise<SwapEventRow[]> {
    return (await fetchBondingCurveSwaps(chainId, { since: sinceTimestamp })).map(toRow)
}

export async function fetchV3SwapEvents(
    chainId: number,
    sinceTimestamp: number
): Promise<SwapEventRow[]> {
    return (await fetchV3Swaps(chainId, { since: sinceTimestamp })).map(toRow)
}

export async function fetchV2SwapEvents(
    chainId: number,
    sinceTimestamp: number
): Promise<SwapEventRow[]> {
    return (await fetchV2Swaps(chainId, { since: sinceTimestamp })).map(toRow)
}

export function fetchSwapEventsForSenders(
    chainId: number,
    senders: string[]
): Promise<SwapEventRow[]> {
    return sdkFetchSwapEventsForSenders(ponderClient, {
        chainId,
        wrappedNative: wrappedNativeFor(chainId),
        senders,
    })
}
