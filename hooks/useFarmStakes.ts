'use client'

import { getStakerAbi, getStakerAddress } from '@/lib/earn-programs'
import { useMemo } from 'react'
import { useChainId, useReadContracts } from 'wagmi'
import type { Address } from 'viem'
import type { StakerDeposit } from '@/hooks/useStakerDeposits'
import type { Incentive, PositionWithTokens, StakedPosition } from '@/types/earn'

export interface FarmStake {
    incentive: Incentive
    position: PositionWithTokens
    depositor: Address
    liquidity: bigint
    secondsPerLiquidityInsideInitialX128: bigint
}

/**
 * Which deposits are staked in which farm. A position can only be staked in an incentive on its own
 * pool, so `stakes()` is read for those pairs rather than every deposit against every farm.
 */
export function useFarmStakes(
    incentives: readonly Incentive[],
    deposits: readonly StakerDeposit[]
): {
    stakes: FarmStake[]
    isLoading: boolean
} {
    const chainId = useChainId()

    const pairs = useMemo(() => {
        if (deposits.length === 0 || incentives.length === 0) return []
        const byPool = new Map<string, StakerDeposit[]>()
        for (const deposit of deposits) {
            const key = deposit.position.poolAddress.toLowerCase()
            const bucket = byPool.get(key)
            if (bucket) bucket.push(deposit)
            else byPool.set(key, [deposit])
        }
        const result: { incentive: Incentive; deposit: StakerDeposit }[] = []
        for (const incentive of incentives) {
            for (const deposit of byPool.get(incentive.pool.toLowerCase()) ?? []) {
                // A deposit lives in one staker; it can only be staked in that staker's farms.
                if (deposit.program !== incentive.program) continue
                result.push({ incentive, deposit })
            }
        }
        return result
    }, [incentives, deposits])

    const contracts = useMemo(() => {
        return pairs.flatMap((pair) => {
            const staker = getStakerAddress(chainId, pair.incentive.program)
            if (!staker) return []
            return [
                {
                    address: staker,
                    abi: getStakerAbi(pair.incentive.program),
                    functionName: 'stakes' as const,
                    args: [pair.deposit.position.tokenId, pair.incentive.incentiveId] as const,
                    chainId,
                },
            ]
        })
    }, [pairs, chainId])

    const { data, isLoading } = useReadContracts({
        contracts,
        query: { enabled: contracts.length > 0, staleTime: 15_000 },
    })

    const stakes = useMemo(() => {
        const result: FarmStake[] = []
        pairs.forEach((pair, index) => {
            // Uniswap: (secondsPerLiquidityInsideInitialX128, liquidity).
            // Juno: (rewardPerLiquidityInitialX128, secondsInsideInitial, stakeTime, liquidity, …).
            const row = data?.[index]?.result as readonly bigint[] | undefined
            const liquidity = row?.[pair.incentive.program === 'juno-v3' ? 3 : 1]
            if (!row || liquidity === undefined || liquidity <= 0n) return
            result.push({
                incentive: pair.incentive,
                position: pair.deposit.position,
                depositor: pair.deposit.depositor,
                liquidity,
                secondsPerLiquidityInsideInitialX128: row[0] ?? 0n,
            })
        })
        return result
    }, [pairs, data])

    return { stakes, isLoading: contracts.length > 0 && isLoading }
}

export function toStakedPosition(stake: FarmStake): StakedPosition {
    return {
        tokenId: stake.position.tokenId,
        incentiveId: stake.incentive.incentiveId,
        liquidity: stake.liquidity,
        secondsPerLiquidityInsideInitialX128: stake.secondsPerLiquidityInsideInitialX128,
        position: stake.position,
        incentive: stake.incentive,
        pendingRewards: 0n,
    }
}
