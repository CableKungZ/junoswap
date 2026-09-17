'use client'

import { useReadContracts } from 'wagmi'
import type { Address } from 'viem'
import { durianfunMarketAbi } from '@/services/launchpad/durianfun'

export function useDurianfunCurveProgress(marketAddr: Address | undefined, chainId: number) {
    const contract = { address: marketAddr, abi: durianfunMarketAbi, chainId } as const
    const { data } = useReadContracts({
        contracts: [
            { ...contract, functionName: 'kubRaised' },
            { ...contract, functionName: 'graduationKub' },
        ],
        allowFailure: false,
        query: { enabled: !!marketAddr, refetchInterval: 10_000 },
    })
    if (!data) return null
    const [kubRaised, graduationKub] = data
    // Not graduationProgress(): its scale differs across Durianfun factory versions.
    const progress = graduationKub > 0n ? Number((kubRaised * 10_000n) / graduationKub) / 100 : 0
    return { kubRaised, graduationKub, progress }
}
