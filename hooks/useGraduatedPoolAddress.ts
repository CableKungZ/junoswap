'use client'

import { useMemo } from 'react'
import type { Address } from 'viem'
import { useV3Pools } from '@/hooks/useV3Pools'
import { findGraduatedPool, GRADUATED_POOL_FEE } from '@/services/launchpad/launchpad'

// The indexer's ammPool field (populated for Durianfun graduations, still null for Junoswap's
// own single graduated token at time of writing) is the real pool address -- prefer it over
// guessing a fee tier, since third-party dexes don't share Junoswap's GRADUATED_POOL_FEE.
// Fall back to the fee-tier guess only when the indexer hasn't backfilled ammPool yet.
export function useGraduatedPoolAddress(
    tokenAddr: Address | undefined,
    wrappedNative: Address | undefined,
    chainId: number,
    ammPool?: Address
): { poolAddress: Address | undefined; isLoading: boolean } {
    const shouldGuess = !!tokenAddr && !!wrappedNative && !ammPool
    const { pools, isLoading } = useV3Pools(chainId, shouldGuess)

    const poolAddress = useMemo(() => {
        if (ammPool) return ammPool
        if (!tokenAddr || !wrappedNative) return undefined
        const pool = findGraduatedPool(pools, tokenAddr, wrappedNative, GRADUATED_POOL_FEE)
        return pool?.address as Address | undefined
    }, [ammPool, pools, tokenAddr, wrappedNative])

    return { poolAddress, isLoading: ammPool ? false : isLoading }
}
