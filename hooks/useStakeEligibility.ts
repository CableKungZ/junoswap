'use client'

import { getStakerAddress } from '@/lib/earn-programs'
import { useMemo } from 'react'
import { useChainId, useReadContracts } from 'wagmi'
import { JUNO_V3_STAKER_ABI } from '@/lib/abis/juno-v3-staker'
import { describeStakeIneligibility } from '@/services/mining/staking'
import type { Incentive, PositionWithTokens } from '@/types/earn'

export interface IneligiblePosition {
    position: PositionWithTokens
    reason: string
}

/**
 * Splits candidate positions into the ones the farm will accept and the ones it will reject,
 * asking the Juno staker itself via `stakeEligibility` so the answer is the same check `stakeToken`
 * runs. The Uniswap staker has no such view: its positions pass through and the stake simulation
 * remains the only gate. A failed read also lets the position through rather than hiding it.
 */
export function useStakeEligibility(
    candidates: readonly PositionWithTokens[],
    incentive: Incentive | null
): { eligible: PositionWithTokens[]; ineligible: IneligiblePosition[]; isLoading: boolean } {
    const chainId = useChainId()
    const stakerAddress = incentive
        ? getStakerAddress(chainId, incentive.program ?? 'v3')
        : undefined
    const isJuno = incentive?.program === 'juno-v3'

    const contracts = useMemo(() => {
        if (!isJuno || !incentive || !stakerAddress) return []
        const key = {
            rewardToken: incentive.rewardToken,
            pool: incentive.pool,
            startTime: BigInt(incentive.startTime),
            endTime: BigInt(incentive.endTime),
            refundee: incentive.refundee,
        }
        return candidates.map((position) => ({
            address: stakerAddress,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'stakeEligibility' as const,
            args: [key, position.tokenId] as const,
            chainId,
        }))
    }, [isJuno, incentive, stakerAddress, candidates, chainId])

    const { data, isLoading } = useReadContracts({
        contracts,
        query: { enabled: contracts.length > 0 },
    })

    return useMemo(() => {
        if (contracts.length === 0) {
            return { eligible: [...candidates], ineligible: [], isLoading: false }
        }
        const eligible: PositionWithTokens[] = []
        const ineligible: IneligiblePosition[] = []
        candidates.forEach((position, i) => {
            const result = data?.[i]
            if (result?.status === 'success') {
                const [ok, reason] = result.result as readonly [boolean, string]
                if (!ok) {
                    ineligible.push({ position, reason: describeStakeIneligibility(reason) })
                    return
                }
            }
            eligible.push(position)
        })
        return { eligible, ineligible, isLoading }
    }, [contracts, candidates, data, isLoading])
}
