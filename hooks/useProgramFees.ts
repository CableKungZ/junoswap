'use client'

import { useChainId, useReadContract, useReadContracts } from 'wagmi'
import type { Address } from 'viem'
import { STAKING_REWARDS_FACTORY_ABI } from '@/lib/abis/staking-rewards'
import { getIncentiveFeeCollector, getStakingRewards, type EarnProgram } from '@/lib/earn-programs'

const FEE_COLLECTOR_ABI = [
    {
        type: 'function',
        name: 'fee',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

/** An ERC-20 fee the creator has to approve before the factory can pull it. */
export interface TokenFee {
    token: Address
    amount: bigint
}

/**
 * What the v2 factory charges to open a staking pool. Ships off (amount 0) but the owner can turn
 * it on at any time, so the form has to read it rather than assume.
 */
export function useStakingFactoryFee(): TokenFee | null {
    const chainId = useChainId()
    const deployment = getStakingRewards(chainId)

    const { data } = useReadContracts({
        contracts: [
            {
                address: deployment?.factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'feeToken' as const,
                chainId,
            },
            {
                address: deployment?.factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'feeAmount' as const,
                chainId,
            },
        ],
        query: { enabled: !!deployment, staleTime: 5 * 60_000 },
    })

    const token = data?.[0]?.result as Address | undefined
    const amount = (data?.[1]?.result as bigint | undefined) ?? 0n
    return amount > 0n && token ? { token, amount } : null
}

/**
 * What creating an incentive on `program` costs in native currency. The stakers are ownerless and
 * charge nothing, so the fee lives in a collector contract in front of each — no collector for this
 * chain and program means no fee.
 */
export function useIncentiveCreationFee(program: EarnProgram): bigint {
    const chainId = useChainId()
    const collector = getIncentiveFeeCollector(chainId, program)

    const { data } = useReadContract({
        address: collector,
        abi: FEE_COLLECTOR_ABI,
        functionName: 'fee',
        query: { enabled: !!collector, staleTime: 5 * 60_000 },
    })
    return data ?? 0n
}
