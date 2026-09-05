'use client'

import { useMemo } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { zeroAddress, type Address } from 'viem'
import { STAKING_REWARDS_ABI } from '@/lib/abis/staking-rewards'

export interface StakingLot {
    index: number
    amount: bigint
    stakedAt: number
    unlockAt: number
}

/**
 * One deposit lot per stake, each with its own unlock time — this is what makes a later deposit
 * unable to re-lock an earlier one, and what `withdrawFrom` indexes into.
 */
export function useStakingLots(
    pool: Address | undefined,
    enabled = true
): { lots: StakingLot[]; isLoading: boolean; refetch: () => void } {
    const chainId = useChainId()
    const { address: account } = useAccount()

    const { data, isLoading, refetch } = useReadContract({
        address: pool,
        abi: STAKING_REWARDS_ABI,
        functionName: 'getUserInfos',
        args: [account ?? zeroAddress],
        chainId,
        query: { enabled: enabled && !!pool && !!account, staleTime: 15_000 },
    })

    const lots = useMemo<StakingLot[]>(() => {
        const rows = data as
            | readonly { amount: bigint; stakedAt: number; unlockAt: number }[]
            | undefined
        if (!rows) return []
        return (
            rows
                .map((row, index) => ({
                    index,
                    amount: row.amount,
                    stakedAt: Number(row.stakedAt),
                    unlockAt: Number(row.unlockAt),
                }))
                // Drained lots stay in the array as zero-amount holes; only live ones are actionable.
                .filter((lot) => lot.amount > 0n)
        )
    }, [data])

    return { lots, isLoading, refetch: () => void refetch() }
}
