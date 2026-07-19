'use client'

import { useMemo, useCallback, useSyncExternalStore } from 'react'
import { useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { fetchDepositsByOwner } from '@coshi190/junoswap-sdk'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import {
    applyOptimisticDeposits,
    subscribeOptimisticDeposits,
    getOptimisticDepositsRevision,
} from '@/lib/optimistic-deposits'

interface UseDepositedTokenIdsResult {
    tokenIds: bigint[]
    isLoading: boolean
    refetch: () => void
}

export function useDepositedTokenIds(
    owner: Address | undefined,
    refreshKey?: number
): UseDepositedTokenIdsResult {
    const chainId = useChainId()
    const {
        data,
        isLoading,
        refetch: refetchDeposits,
    } = useQuery({
        queryKey: ['deposited-token-ids', chainId, owner, refreshKey],
        queryFn: async () => {
            try {
                return await fetchDepositsByOwner(ponderClient, { chainId, owner: owner! })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: !!owner,
        staleTime: 15_000,
    })
    const optimisticVersion = useSyncExternalStore(
        subscribeOptimisticDeposits,
        getOptimisticDepositsRevision,
        () => 0
    )
    const tokenIds = useMemo(() => {
        const indexed = (data ?? []).map((row) => BigInt(row.tokenId))
        return applyOptimisticDeposits(chainId, owner, indexed)
    }, [data, chainId, owner, optimisticVersion])
    const refetch = useCallback(() => {
        refetchDeposits()
    }, [refetchDeposits])
    return {
        tokenIds,
        isLoading: !!owner && isLoading,
        refetch,
    }
}
