'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import {
    computeReferralRewards,
    fetchReferralData,
    type ReferredTrader,
} from '@coshi190/junoswap-sdk'
import { isLeaderboardSupportedChain } from '@/lib/leaderboard-utils'
import { ponderClient } from '@/lib/ponder-client'

export interface ReferralRewards {
    referralPoints: number
    refereeCount: number
    referees: ReferredTrader[]
    isLoading: boolean
    isSupportedChain: boolean
}

export function useReferralRewards(nativeUsdPrice: number | null): ReferralRewards {
    const { address } = useAccount()
    const chainId = useChainId()
    const isSupportedChain = isLeaderboardSupportedChain(chainId)
    const enabled = isSupportedChain && !!address

    const { data, isLoading } = useQuery({
        queryKey: ['referral-rewards', address?.toLowerCase(), chainId],
        queryFn: () =>
            fetchReferralData(ponderClient, {
                chainId,
                referrer: address!,
            }),
        enabled,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })

    return useMemo(() => {
        if (!enabled || !data) {
            return {
                referralPoints: 0,
                refereeCount: 0,
                referees: [],
                isLoading: enabled && isLoading,
                isSupportedChain,
            }
        }
        return {
            ...computeReferralRewards(data.referees, data.stats, nativeUsdPrice),
            isLoading: false,
            isSupportedChain,
        }
    }, [enabled, data, isLoading, nativeUsdPrice, isSupportedChain])
}
