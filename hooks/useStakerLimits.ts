'use client'

import { getStakerAddress, type EarnProgram } from '@/lib/earn-programs'
import { useMemo } from 'react'
import { useChainId, useReadContracts } from 'wagmi'
import { FALLBACK_STAKER_LIMITS } from '@/services/mining/create-incentive'
import type { StakerLimits } from '@/types/earn'

const STAKER_LIMITS_ABI = [
    {
        type: 'function',
        name: 'maxIncentiveDuration',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'maxIncentiveStartLeadTime',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

/**
 * Both caps are immutables set at deploy time, so they are read per chain rather than assumed.
 * A staker that does not answer falls back to the canonical values and says so, so the form can
 * present the cap without claiming a number it never verified.
 */
export function useStakerLimits(program: EarnProgram = 'v3'): {
    limits: StakerLimits
    isLoading: boolean
    isFallback: boolean
} {
    const chainId = useChainId()
    const stakerAddress = getStakerAddress(chainId, program)

    const { data, isLoading } = useReadContracts({
        contracts: [
            {
                address: stakerAddress,
                abi: STAKER_LIMITS_ABI,
                functionName: 'maxIncentiveDuration',
                chainId,
            },
            {
                address: stakerAddress,
                abi: STAKER_LIMITS_ABI,
                functionName: 'maxIncentiveStartLeadTime',
                chainId,
            },
        ],
        query: {
            enabled: !!stakerAddress,
            staleTime: Infinity,
        },
    })

    return useMemo(() => {
        const duration = data?.[0]?.result
        const leadTime = data?.[1]?.result
        if (typeof duration !== 'bigint' || typeof leadTime !== 'bigint') {
            return { limits: FALLBACK_STAKER_LIMITS, isLoading, isFallback: true }
        }
        return {
            limits: {
                maxIncentiveDuration: Number(duration),
                maxIncentiveStartLeadTime: Number(leadTime),
            },
            isLoading,
            isFallback: false,
        }
    }, [data, isLoading])
}
