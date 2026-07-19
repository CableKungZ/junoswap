import {
    fetchUserPnl,
    fetchLeaderboardStats,
    type UserPnlResponse,
    type LeaderboardTraderStat,
    type PortfolioPnlTotals,
} from '@coshi190/junoswap-sdk'

export const EMPTY_PNL_TOTALS: PortfolioPnlTotals = {
    totalInvestedUsd: 0,
    realizedUsd: 0,
    unrealizedUsd: 0,
    totalPnlUsd: 0,
    totalPnlPercent: 0,
}

function ponderBaseUrl(): string | null {
    return process.env.NEXT_PUBLIC_PONDER_URL ?? null
}

export async function fetchPortfolioPnl(chainId: number, user: string): Promise<UserPnlResponse> {
    const baseUrl = ponderBaseUrl()
    if (!baseUrl) return { perToken: {}, totals: EMPTY_PNL_TOTALS }
    try {
        return await fetchUserPnl(baseUrl, { chainId, user })
    } catch {
        return { perToken: {}, totals: EMPTY_PNL_TOTALS }
    }
}

export async function fetchLeaderboardTraders(
    chainId: number,
    period: string
): Promise<LeaderboardTraderStat[]> {
    const baseUrl = ponderBaseUrl()
    if (!baseUrl) return []
    try {
        return (await fetchLeaderboardStats(baseUrl, { chainId, period })).traders
    } catch {
        return []
    }
}
