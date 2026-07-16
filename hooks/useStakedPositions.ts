'use client'

import { useMemo } from 'react'
import { useReadContracts, useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { StakedPosition, Incentive, DepositInfo, PositionWithTokens } from '@/types/earn'
import {
    getV3StakerAddress,
    UNISWAP_V3_STAKER_ABI,
    fetchPositionsByTokenIds,
} from '@coshi190/junoswap-sdk'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
export function useStakedPositions(
    positions: PositionWithTokens[],
    incentives: Incentive[],
    owner: Address | undefined
): {
    stakedPositions: StakedPosition[]
    depositedPositions: PositionWithTokens[]
    isLoading: boolean
    refetch: () => void
} {
    const chainId = useChainId()
    const stakerAddress = getV3StakerAddress(chainId)
    const tokenIdKey = useMemo(() => positions.map((p) => p.tokenId.toString()), [positions])
    const {
        data: depositRows,
        isLoading: isLoadingDeposits,
        refetch: refetchDeposits,
    } = useQuery({
        queryKey: ['staked-deposits', chainId, tokenIdKey],
        queryFn: async () => {
            try {
                return await fetchPositionsByTokenIds(ponderClient, {
                    chainId,
                    tokenIds: positions.map((p) => p.tokenId),
                })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: !!owner && !!stakerAddress && positions.length > 0,
        staleTime: 15_000, // 15 seconds
    })
    const depositedPositionIds = useMemo(() => {
        if (!depositRows || !stakerAddress) return new Set<string>()
        const staker = stakerAddress.toLowerCase()
        const deposited = new Set<string>()
        for (const row of depositRows) {
            if (row.owner.toLowerCase() === staker) deposited.add(row.tokenId.toString())
        }
        return deposited
    }, [depositRows, stakerAddress])
    const depositedPositions = useMemo(() => {
        return positions.filter((p) => depositedPositionIds.has(p.tokenId.toString()))
    }, [positions, depositedPositionIds])
    const stakeContracts = useMemo(() => {
        if (!stakerAddress || depositedPositions.length === 0 || incentives.length === 0) {
            return []
        }
        const contracts: Array<{
            address: Address
            abi: typeof UNISWAP_V3_STAKER_ABI
            functionName: 'stakes'
            args: readonly [bigint, `0x${string}`]
            chainId: number
        }> = []
        depositedPositions.forEach((position) => {
            incentives.forEach((incentive) => {
                contracts.push({
                    address: stakerAddress,
                    abi: UNISWAP_V3_STAKER_ABI,
                    functionName: 'stakes' as const,
                    args: [position.tokenId, incentive.incentiveId] as const,
                    chainId,
                })
            })
        })
        return contracts
    }, [stakerAddress, depositedPositions, incentives, chainId])
    const {
        data: stakeData,
        isLoading: isLoadingStakes,
        refetch: refetchStakes,
    } = useReadContracts({
        contracts: stakeContracts,
        query: {
            enabled: stakeContracts.length > 0,
            staleTime: 15_000,
        },
    })
    const stakedPositions = useMemo<StakedPosition[]>(() => {
        if (!stakeData || depositedPositions.length === 0 || incentives.length === 0) {
            return []
        }
        const result: StakedPosition[] = []
        let stakeIndex = 0
        depositedPositions.forEach((position) => {
            incentives.forEach((incentive) => {
                const stake = stakeData[stakeIndex]?.result as [bigint, bigint] | undefined
                stakeIndex++
                if (stake && stake[1] > 0n) {
                    result.push({
                        tokenId: position.tokenId,
                        incentiveId: incentive.incentiveId,
                        liquidity: stake[1],
                        secondsPerLiquidityInsideInitialX128: stake[0],
                        position,
                        incentive,
                        pendingRewards: 0n, // Fetched separately via useRewards
                    })
                }
            })
        })
        return result
    }, [depositedPositions, incentives, stakeData])
    const refetch = () => {
        refetchDeposits()
        refetchStakes()
    }
    return {
        stakedPositions,
        depositedPositions,
        isLoading: isLoadingDeposits || isLoadingStakes,
        refetch,
    }
}

export function useDepositInfo(tokenId: bigint | undefined): {
    deposit: DepositInfo | null
    isDeposited: boolean
    isLoading: boolean
} {
    const chainId = useChainId()
    const stakerAddress = getV3StakerAddress(chainId)
    const { data, isLoading } = useReadContracts({
        contracts: [
            {
                address: stakerAddress!,
                abi: UNISWAP_V3_STAKER_ABI,
                functionName: 'deposits' as const,
                args: [tokenId!] as const,
                chainId,
            },
        ],
        query: {
            enabled: !!stakerAddress && tokenId !== undefined,
            staleTime: 15_000,
        },
    })
    const deposit = useMemo<DepositInfo | null>(() => {
        const result = data?.[0]?.result as [Address, number, number, number] | undefined
        if (!result) return null

        return {
            owner: result[0],
            numberOfStakes: result[1],
            tickLower: result[2],
            tickUpper: result[3],
        }
    }, [data])
    const isDeposited =
        deposit !== null && deposit.owner !== '0x0000000000000000000000000000000000000000'
    return {
        deposit,
        isDeposited,
        isLoading,
    }
}
