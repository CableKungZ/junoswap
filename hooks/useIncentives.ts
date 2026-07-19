'use client'

import { useMemo } from 'react'
import { useReadContracts, useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { Incentive } from '@/types/earn'
import {
    fetchIncentives,
    fetchV3Pools,
    getV3StakerAddress,
    UNISWAP_V3_STAKER_ABI,
    type V3PoolRow,
} from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import { findTokenByAddress } from '@/lib/tokens'
import { useV3Tokens } from '@/hooks/useV3Tokens'
import { isIncentiveActive, isIncentiveEnded } from '@/services/mining/incentives'

const PONDER_INDEXED_CHAINS = new Set([25925, 96, 8899])

export function useIncentives(): {
    incentives: Incentive[]
    isLoading: boolean
    refetch: () => void
} {
    const chainId = useChainId()
    const isIndexed = PONDER_INDEXED_CHAINS.has(chainId)
    const stakerAddress = getV3StakerAddress(chainId)

    const {
        data: incentiveRows,
        isLoading: isLoadingRows,
        refetch: refetchRows,
    } = useQuery({
        queryKey: ['incentives', chainId],
        queryFn: async () => {
            try {
                return await fetchIncentives(ponderClient, { chainId })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: isIndexed,
        staleTime: 60_000,
    })

    const { data: pools, isLoading: isLoadingPools } = useQuery({
        queryKey: ['v3-pools-all', chainId],
        queryFn: async () => {
            try {
                return await fetchV3Pools(ponderClient, { chainId })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: isIndexed,
        staleTime: 60_000,
    })
    const { tokens: v3Tokens, isLoading: isLoadingTokens } = useV3Tokens(chainId)

    const rows = useMemo(() => incentiveRows ?? [], [incentiveRows])

    const stateContracts = useMemo(() => {
        if (!stakerAddress) return []
        return rows.map((row) => ({
            address: stakerAddress,
            abi: UNISWAP_V3_STAKER_ABI,
            functionName: 'incentives' as const,
            args: [row.incentiveId as `0x${string}`] as const,
            chainId,
        }))
    }, [stakerAddress, rows, chainId])

    const {
        data: stateData,
        isLoading: isLoadingState,
        refetch: refetchState,
    } = useReadContracts({
        contracts: stateContracts,
        query: {
            enabled: stateContracts.length > 0,
            staleTime: 30_000,
        },
    })

    const poolByAddress = useMemo(() => {
        const map = new Map<string, V3PoolRow>()
        for (const pool of pools ?? []) map.set(pool.address.toLowerCase(), pool)
        return map
    }, [pools])

    const tokenByAddress = useMemo(() => {
        const map = new Map<string, Token>()
        for (const t of v3Tokens) {
            const address = t.address as Address
            map.set(address.toLowerCase(), {
                address,
                symbol: t.symbol || '???',
                name: t.name || t.symbol || '',
                decimals: t.decimals ?? 18,
                chainId,
                logo: findTokenByAddress(chainId, address)?.logo,
            })
        }
        return map
    }, [v3Tokens, chainId])

    const incentives = useMemo<Incentive[]>(() => {
        const stateById = new Map<string, readonly [bigint, bigint, bigint]>()
        rows.forEach((row, index) => {
            const result = stateData?.[index]?.result as
                | readonly [bigint, bigint, bigint]
                | undefined
            if (result) stateById.set(row.incentiveId, result)
        })

        return rows
            .map((row) => {
                const pool = poolByAddress.get(row.pool.toLowerCase())
                const rewardTokenInfo = tokenByAddress.get(row.rewardToken.toLowerCase())
                const poolToken0 = pool ? tokenByAddress.get(pool.token0.toLowerCase()) : undefined
                const poolToken1 = pool ? tokenByAddress.get(pool.token1.toLowerCase()) : undefined
                if (!pool || !rewardTokenInfo || !poolToken0 || !poolToken1) return null

                const state = stateById.get(row.incentiveId)
                const key = {
                    rewardToken: row.rewardToken as Address,
                    pool: row.pool as Address,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    refundee: row.refundee as Address,
                }

                return {
                    ...key,
                    incentiveId: row.incentiveId as `0x${string}`,
                    totalRewardUnclaimed: state?.[0] ?? BigInt(row.reward),
                    totalSecondsClaimedX128: state?.[1] ?? 0n,
                    numberOfStakes: Number(state?.[2] ?? 0n),
                    rewardTokenInfo,
                    poolToken0,
                    poolToken1,
                    poolFee: pool.fee,
                    isActive: isIncentiveActive(key),
                    isEnded: isIncentiveEnded(key),
                }
            })
            .filter((i): i is Incentive => i !== null)
    }, [rows, stateData, poolByAddress, tokenByAddress])

    const refetch = useMemo(
        () => () => {
            void refetchRows()
            void refetchState()
        },
        [refetchRows, refetchState]
    )

    return {
        incentives,
        isLoading: isLoadingRows || isLoadingPools || isLoadingTokens || isLoadingState,
        refetch,
    }
}
