import { kubTestnet, bitkub, jbc } from '@/lib/wagmi'
import { computeReferralPoints } from '@coshi190/junoswap-sdk'

export { computeReferralPoints }

const LEADERBOARD_SUPPORTED_CHAINS = new Set<number>([kubTestnet.id, bitkub.id, jbc.id])

export function isLeaderboardSupportedChain(chainId: number): boolean {
    return LEADERBOARD_SUPPORTED_CHAINS.has(chainId)
}
