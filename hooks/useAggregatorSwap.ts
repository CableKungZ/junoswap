'use client'

import { useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import type { Address } from 'viem'
import { SWAP_AGGREGATOR_ABI } from '@/lib/abis/swap-aggregator'
import { getAggregatorConfig } from '@/lib/aggregator-config'
import { useAggregatorStore } from '@/store/aggregator-store'
import { calculateMinOutput } from '@/services/dex/uniswap-v2'
import type { AggregatorRoute } from '@/services/aggregator/best-route'

interface ExecuteParams {
    chainId: number
    route: AggregatorRoute
    amountIn: bigint
    recipient: Address
}

export function useAggregatorSwap() {
    const { settings } = useAggregatorStore()
    const { data: hash, writeContract, isPending, isError, error, reset } = useWriteContract()
    const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

    const executeRoute = useCallback(
        ({ chainId, route, amountIn, recipient }: ExecuteParams) => {
            const config = getAggregatorConfig(chainId)
            if (!config) return

            const slippageBps = Math.round(settings.slippage * 100)
            // Slippage applies to the NET quote — the contract checks amountOutMin
            // against what the recipient actually receives (after the aggregator fee).
            const amountOutMin = calculateMinOutput(route.netAmountOut, slippageBps)
            const deadline = BigInt(Math.floor(Date.now() / 1000) + settings.deadlineMinutes * 60)

            writeContract({
                address: config.aggregator,
                abi: SWAP_AGGREGATOR_ABI,
                functionName: 'executeRoute',
                args: [route.hops, amountIn, amountOutMin, recipient, deadline],
                chainId,
            })
        },
        [settings.slippage, settings.deadlineMinutes, writeContract]
    )

    return { executeRoute, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}
