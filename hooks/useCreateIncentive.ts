'use client'

import { getIncentiveFeeCollector, getStakerAddress, type EarnProgram } from '@/lib/earn-programs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useAccount,
    useChainId,
    useReadContract,
    useSimulateContract,
    useWaitForTransactionReceipt,
    useWriteContract,
} from 'wagmi'
import type { Address, Hex } from 'viem'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import {
    buildIncentiveKey,
    parseRewardAmount,
    validateCreateIncentive,
} from '@/services/mining/create-incentive'
import { computeIncentiveId } from '@/services/mining/staking'
import type {
    CreateIncentiveError,
    CreateIncentiveForm,
    IncentiveKey,
    StakerLimits,
} from '@/types/earn'

const FEE_COLLECTOR_ABI = [
    {
        type: 'function',
        name: 'fee',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

const CREATE_INCENTIVE_ABI = [
    {
        type: 'function',
        name: 'createIncentive',
        stateMutability: 'payable',
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
            { name: 'reward', type: 'uint256' },
        ],
        outputs: [],
    },
] as const

interface UseCreateIncentiveResult {
    errors: CreateIncentiveError[]
    incentiveKey: IncentiveKey | null
    incentiveId: Hex | null
    rewardAmount: bigint
    balance: bigint
    stakerAddress: Address | undefined
    /** Where the create is actually sent: the fee collector when the chain has one. */
    spender: Address | undefined
    /** Creation fee in native currency, charged once per incentive. 0 when there is none. */
    creationFee: bigint
    needsApproval: boolean
    approve: () => void
    create: () => void
    /** Approve if needed and create in one click; the create fires once the allowance lands. */
    submit: () => void
    isAwaitingApproval: boolean
    isApproving: boolean
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    error: Error | null
    hash: Hex | undefined
}

/**
 * Approve-then-create against the staker, behind one `submit()`. The simulate stays disabled until
 * the form is valid and the allowance is in place, so the confirm button never hands the wallet a
 * call that is already known to revert — which is also why the create waits for the simulation
 * that the approval unblocks rather than firing straight after the approval receipt.
 */
export function useCreateIncentive(
    form: CreateIncentiveForm,
    limits: StakerLimits,
    program: EarnProgram = 'v3'
): UseCreateIncentiveResult {
    const { address } = useAccount()
    const chainId = useChainId()
    const now = useNowSeconds()
    const stakerAddress = getStakerAddress(chainId, program)
    // The juno-v3 staker is ownerless and charges nothing, so the fee lives in a contract in front
    // of it. Where one is deployed the whole create — approval included — goes through that.
    const feeCollector = program === 'juno-v3' ? getIncentiveFeeCollector(chainId) : undefined
    const target = feeCollector ?? stakerAddress

    const { data: feeData } = useReadContract({
        address: feeCollector,
        abi: FEE_COLLECTOR_ABI,
        functionName: 'fee',
        query: { enabled: !!feeCollector, staleTime: 5 * 60_000 },
    })
    const creationFee = feeCollector ? ((feeData as bigint | undefined) ?? 0n) : 0n

    const { balance } = useTokenBalance({ token: form.rewardToken, address })

    const rewardAmount = useMemo(() => {
        if (!form.rewardToken) return 0n
        return parseRewardAmount(form.rewardAmount, form.rewardToken.decimals) ?? 0n
    }, [form.rewardAmount, form.rewardToken])

    const errors = useMemo(
        () => validateCreateIncentive(form, { now, balance, limits, account: address }),
        [form, now, balance, limits, address]
    )

    const incentiveKey = useMemo(
        () => buildIncentiveKey(form, { now, account: address }),
        [form, now, address]
    )

    const incentiveId = useMemo(
        () => (incentiveKey ? computeIncentiveId(incentiveKey) : null),
        [incentiveKey]
    )

    const {
        needsApproval,
        approve: approveReward,
        isApproving,
        isConfirming: isConfirmingApproval,
        error: approvalError,
    } = useTokenApproval({
        token: form.rewardToken,
        owner: address,
        spender: target,
        amountToApprove: rewardAmount > 0n ? rewardAmount : undefined,
    })

    const args = useMemo(() => {
        if (!incentiveKey || rewardAmount <= 0n) return undefined
        return [
            {
                rewardToken: incentiveKey.rewardToken,
                pool: incentiveKey.pool,
                startTime: BigInt(incentiveKey.startTime),
                endTime: BigInt(incentiveKey.endTime),
                refundee: incentiveKey.refundee,
            },
            rewardAmount,
        ] as const
    }, [incentiveKey, rewardAmount])

    const canSimulate = !!target && !!args && errors.length === 0 && !needsApproval

    const {
        data: simulation,
        isLoading: isPreparing,
        error: simulationError,
    } = useSimulateContract({
        address: target,
        abi: CREATE_INCENTIVE_ABI,
        functionName: 'createIncentive',
        args,
        value: creationFee,
        query: { enabled: canSimulate },
    })

    const {
        writeContract,
        data: hash,
        isPending: isExecuting,
        error: writeError,
    } = useWriteContract()

    const {
        isLoading: isConfirmingCreate,
        isSuccess,
        error: receiptError,
    } = useWaitForTransactionReceipt({ hash })

    const create = useCallback(() => {
        if (!simulation?.request) return
        writeContract(simulation.request)
    }, [simulation, writeContract])

    // One click for the whole thing: approve, then send the create the moment the allowance has
    // landed and the simulation it unblocks is ready. Nothing to click twice.
    const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)

    useEffect(() => {
        if (!isAwaitingApproval || needsApproval || !simulation?.request) return
        setIsAwaitingApproval(false)
        writeContract(simulation.request)
    }, [isAwaitingApproval, needsApproval, simulation, writeContract])

    useEffect(() => {
        if (writeError || approvalError) setIsAwaitingApproval(false)
    }, [writeError, approvalError])

    const submit = useCallback(() => {
        if (needsApproval) {
            setIsAwaitingApproval(true)
            approveReward()
            return
        }
        create()
    }, [needsApproval, approveReward, create])

    return {
        errors,
        incentiveKey,
        incentiveId,
        rewardAmount,
        balance,
        stakerAddress,
        spender: target,
        creationFee,
        needsApproval,
        approve: approveReward,
        create,
        submit,
        isAwaitingApproval,
        isApproving: isApproving || isConfirmingApproval,
        isPreparing: canSimulate && isPreparing,
        isExecuting,
        isConfirming: isConfirmingCreate,
        isSuccess,
        error:
            writeError || receiptError || (canSimulate ? (simulationError as Error | null) : null),
        hash,
    }
}
