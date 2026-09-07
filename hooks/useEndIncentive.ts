'use client'

import { getStakerAddress } from '@/lib/earn-programs'
import { useCallback, useMemo } from 'react'
import {
    useChainId,
    useSimulateContract,
    useWaitForTransactionReceipt,
    useWriteContract,
} from 'wagmi'
import type { Hex } from 'viem'
import { canEndIncentive } from '@/services/mining/incentives'
import type { Incentive } from '@/types/earn'

const END_INCENTIVE_ABI = [
    {
        type: 'function',
        name: 'endIncentive',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'rewardToken', type: 'address' },
                    { name: 'pool', type: 'address' },
                    { name: 'startTime', type: 'uint256' },
                    { name: 'endTime', type: 'uint256' },
                    { name: 'refundee', type: 'address' },
                ],
            },
        ],
        outputs: [{ type: 'uint256' }],
    },
] as const

/**
 * Closes a finished incentive and returns the unclaimed reward to its refundee. The staker sends
 * the refund to `key.refundee`, not to the caller, so anyone may settle a farm on the creator's
 * behalf.
 */
export function useEndIncentive(incentive: Incentive | null): {
    endIncentive: () => void
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    error: Error | null
    hash: Hex | undefined
} {
    const chainId = useChainId()
    const stakerAddress = getStakerAddress(chainId, incentive?.program ?? 'v3')
    const isEligible = !!incentive && canEndIncentive(incentive)

    const args = useMemo(() => {
        if (!incentive) return undefined
        return [
            {
                rewardToken: incentive.rewardToken,
                pool: incentive.pool,
                startTime: BigInt(incentive.startTime),
                endTime: BigInt(incentive.endTime),
                refundee: incentive.refundee,
            },
        ] as const
    }, [incentive])

    const enabled = !!stakerAddress && !!args && isEligible

    const {
        data: simulation,
        isLoading: isPreparing,
        error: simulationError,
    } = useSimulateContract({
        address: stakerAddress,
        abi: END_INCENTIVE_ABI,
        functionName: 'endIncentive',
        args,
        query: { enabled },
    })

    const {
        writeContract,
        data: hash,
        isPending: isExecuting,
        error: writeError,
    } = useWriteContract()

    const {
        isLoading: isConfirming,
        isSuccess,
        error: receiptError,
    } = useWaitForTransactionReceipt({ hash })

    const endIncentive = useCallback(() => {
        if (!simulation?.request) return
        writeContract(simulation.request)
    }, [simulation, writeContract])

    return {
        endIncentive,
        isPreparing: enabled && isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        error: writeError || receiptError || (enabled ? (simulationError as Error | null) : null),
        hash,
    }
}
