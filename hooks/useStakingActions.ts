'use client'

import { useCallback } from 'react'
import { useChainId, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { maxUint256, type Address } from 'viem'
import { ERC20_ABI } from '@coshi190/juno-moneta-sdk'
import { STAKING_REWARDS_ABI, STAKING_REWARDS_FACTORY_ABI } from '@/lib/abis/staking-rewards'
import { getStakingRewards } from '@/lib/earn-programs'

interface TxState {
    isPending: boolean
    isConfirming: boolean
    isSuccess: boolean
    error: Error | null
    hash: `0x${string}` | undefined
}

function useTx(): TxState & { write: ReturnType<typeof useWriteContract>['writeContract'] } {
    const { writeContract, data: hash, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
    return { write: writeContract, hash, isPending, isConfirming, isSuccess, error }
}

/** Approve, stake, withdraw and claim against one pool. The lens already reports the
 * allowance, so approval state comes from the pool list rather than a second read here. */
export function useStakingPoolActions(
    pool: Address | undefined,
    stakingToken: Address | undefined
) {
    const chainId = useChainId()
    const tx = useTx()

    const approve = useCallback(() => {
        if (!pool || !stakingToken) return
        tx.write({
            address: stakingToken,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [pool, maxUint256],
            chainId,
        })
    }, [tx, pool, stakingToken, chainId])

    const stake = useCallback(
        (amount: bigint) => {
            if (!pool) return
            tx.write({
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'stake',
                args: [amount],
                chainId,
            })
        },
        [tx, pool, chainId]
    )

    const withdraw = useCallback(
        (amount: bigint) => {
            if (!pool) return
            tx.write({
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'withdraw',
                args: [amount],
                chainId,
            })
        },
        [tx, pool, chainId]
    )

    const claim = useCallback(() => {
        if (!pool) return
        tx.write({
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getReward',
            chainId,
        })
    }, [tx, pool, chainId])

    /** Withdraw from one deposit lot directly, instead of draining unlocked lots oldest first. */
    const withdrawFrom = useCallback(
        (index: bigint, amount: bigint) => {
            if (!pool) return
            tx.write({
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'withdrawFrom',
                args: [index, amount],
                chainId,
            })
        },
        [tx, pool, chainId]
    )

    /** Creator only, between epochs: retires the pool for good and unlocks recovery. */
    const close = useCallback(() => {
        if (!pool) return
        tx.write({
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'close',
            chainId,
        })
    }, [tx, pool, chainId])

    /** Creator only, after close: pulls back the budget that ran while nothing was staked. */
    const recoverUnallocated = useCallback(() => {
        if (!pool) return
        tx.write({
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'recoverUnallocatedRewards',
            chainId,
        })
    }, [tx, pool, chainId])

    return { approve, stake, withdraw, withdrawFrom, claim, close, recoverUnallocated, ...tx }
}

/** Harvests several pools in one transaction, through the factory. */
export function useClaimAllStaking() {
    const chainId = useChainId()
    const deployment = getStakingRewards(chainId)
    const tx = useTx()

    const claimAll = useCallback(
        (pools: readonly Address[]) => {
            if (!deployment || pools.length === 0) return
            tx.write({
                address: deployment.factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'claimAll',
                args: [pools],
                chainId,
            })
        },
        [tx, deployment, chainId]
    )

    return { claimAll, ...tx }
}

/** Funds the next epoch of a pool that has already run one, keeping every stake in place. */
export function useStartEpoch() {
    const chainId = useChainId()
    const deployment = getStakingRewards(chainId)
    const tx = useTx()

    const startEpoch = useCallback(
        (pool: Address, params: Omit<CreateStakingPoolParams, 'stakingToken' | 'rewardsToken'>) => {
            if (!deployment) return
            tx.write({
                address: deployment.factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'startEpoch',
                args: [
                    pool,
                    params.rewardAmount,
                    params.startTime,
                    params.rewardsDuration,
                    params.lockDuration,
                    params.maxStakingPower,
                ],
                chainId,
            })
        },
        [tx, deployment, chainId]
    )

    const approveReward = useCallback(
        (rewardsToken: Address) => {
            if (!deployment) return
            tx.write({
                address: rewardsToken,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [deployment.factory, maxUint256],
                chainId,
            })
        },
        [tx, deployment, chainId]
    )

    return { startEpoch, approveReward, factory: deployment?.factory, ...tx }
}

export interface CreateStakingPoolParams {
    stakingToken: Address
    rewardsToken: Address
    rewardAmount: bigint
    /** unix seconds; 0 starts the epoch immediately */
    startTime: bigint
    rewardsDuration: bigint
    lockDuration: bigint
    /** 0 = uncapped */
    maxStakingPower: bigint
}

/** Opens a pool and funds its first epoch. The factory pulls the reward from the creator, so
 * the reward token must be approved to the *factory* first. */
export function useCreateStakingPool() {
    const chainId = useChainId()
    const deployment = getStakingRewards(chainId)
    const tx = useTx()

    // The factory may charge a fee to open a pool. It ships off (amount 0) but the owner can turn
    // it on, and `deploy` then pulls it too — so the form has to know before it submits.
    const { data: feeData } = useReadContracts({
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
    const feeAmount = (feeData?.[1]?.result as bigint | undefined) ?? 0n
    const feeToken = feeData?.[0]?.result as Address | undefined
    const fee = feeAmount > 0n && feeToken ? { token: feeToken, amount: feeAmount } : null

    const approveReward = useCallback(
        (rewardsToken: Address) => {
            if (!deployment) return
            tx.write({
                address: rewardsToken,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [deployment.factory, maxUint256],
                chainId,
            })
        },
        [tx, deployment, chainId]
    )

    const create = useCallback(
        (params: CreateStakingPoolParams) => {
            if (!deployment) return
            tx.write({
                address: deployment.factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'deploy',
                args: [
                    params.stakingToken,
                    params.rewardsToken,
                    params.rewardAmount,
                    params.startTime,
                    params.rewardsDuration,
                    params.lockDuration,
                    params.maxStakingPower,
                ],
                chainId,
            })
        },
        [tx, deployment, chainId]
    )

    return { approveReward, create, fee, factory: deployment?.factory, ...tx }
}
