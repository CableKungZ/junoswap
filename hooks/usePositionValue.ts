'use client'

import { useMemo } from 'react'
import { useReadContracts, useChainId } from 'wagmi'
import type { Address } from 'viem'
import type { PositionWithTokens } from '@/types/earn'
import { UNISWAP_V3_POOL_ABI } from '@/lib/abis/uniswap-v3-pool'
import {
    getAmountsForLiquidity,
    tickToSqrtPriceX96,
    isInRange,
    sqrtPriceX96ToPrice,
    tickToPrice,
} from '@/lib/liquidity-helpers'
import { formatTokenAmount } from '@/services/tokens'

export function usePositionValue(position: PositionWithTokens | null): {
    amount0: bigint
    amount1: bigint
    amount0Formatted: string
    amount1Formatted: string
    uncollectedFees0: bigint
    uncollectedFees1: bigint
    fees0Formatted: string
    fees1Formatted: string
    inRange: boolean
    currentPrice: string
    priceLower: string
    priceUpper: string
    currentTick: number
    isLoading: boolean
} {
    const chainId = useChainId()
    const isEnabled =
        !!position && position.poolAddress !== '0x0000000000000000000000000000000000000000'
    const { data: poolState, isLoading } = useReadContracts({
        contracts: [
            {
                address: position?.poolAddress as Address,
                abi: UNISWAP_V3_POOL_ABI,
                functionName: 'slot0',
                chainId,
            },
        ],
        query: {
            enabled: isEnabled,
            staleTime: 10_000, // 10 seconds
            refetchInterval: 30_000, // Refetch every 30 seconds
        },
    })
    return useMemo(() => {
        const defaultResult = {
            amount0: 0n,
            amount1: 0n,
            amount0Formatted: '0',
            amount1Formatted: '0',
            uncollectedFees0: 0n,
            uncollectedFees1: 0n,
            fees0Formatted: '0',
            fees1Formatted: '0',
            inRange: false,
            currentPrice: '0',
            priceLower: '0',
            priceUpper: '0',
            currentTick: position?.tickLower ?? 0,
            isLoading,
        }
        if (!position) return defaultResult
        const slot0 = poolState?.[0]?.result as
            | [bigint, number, number, number, number, number, boolean]
            | undefined
        let sqrtPriceX96 = 0n
        let currentTick = position.tickLower
        if (slot0) {
            sqrtPriceX96 = slot0[0]
            currentTick = slot0[1]
        }
        let amount0 = position.amount0
        let amount1 = position.amount1
        if (sqrtPriceX96 > 0n && position.liquidity > 0n) {
            const sqrtPriceAX96 = tickToSqrtPriceX96(position.tickLower)
            const sqrtPriceBX96 = tickToSqrtPriceX96(position.tickUpper)
            const amounts = getAmountsForLiquidity(
                sqrtPriceX96,
                sqrtPriceAX96,
                sqrtPriceBX96,
                position.liquidity
            )
            amount0 = amounts.amount0
            amount1 = amounts.amount1
        }
        const decimals0 = position.token0Info.decimals
        const decimals1 = position.token1Info.decimals
        const currentPrice =
            sqrtPriceX96 > 0n ? sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1) : '0'
        const priceLower = tickToPrice(position.tickLower, decimals0, decimals1)
        const priceUpper = tickToPrice(position.tickUpper, decimals0, decimals1)
        return {
            amount0,
            amount1,
            amount0Formatted: formatTokenAmount(amount0, decimals0),
            amount1Formatted: formatTokenAmount(amount1, decimals1),
            uncollectedFees0: position.tokensOwed0,
            uncollectedFees1: position.tokensOwed1,
            fees0Formatted: formatTokenAmount(position.tokensOwed0, decimals0),
            fees1Formatted: formatTokenAmount(position.tokensOwed1, decimals1),
            inRange: isInRange(currentTick, position.tickLower, position.tickUpper),
            currentPrice,
            priceLower,
            priceUpper,
            currentTick,
            isLoading,
        }
    }, [position, poolState, isLoading])
}

export function usePositionAPR(
    position: PositionWithTokens | null,
    token0PriceUsd?: number,
    token1PriceUsd?: number
): {
    apr: number | null
    totalValueUsd: number | null
    feesValueUsd: number | null
} {
    const { amount0, amount1, uncollectedFees0, uncollectedFees1 } = usePositionValue(position)
    return useMemo(() => {
        if (!position || token0PriceUsd === undefined || token1PriceUsd === undefined) {
            return { apr: null, totalValueUsd: null, feesValueUsd: null }
        }
        const decimals0 = position.token0Info.decimals
        const decimals1 = position.token1Info.decimals
        const value0Usd = (Number(amount0) / 10 ** decimals0) * token0PriceUsd
        const value1Usd = (Number(amount1) / 10 ** decimals1) * token1PriceUsd
        const totalValueUsd = value0Usd + value1Usd
        const fees0Usd = (Number(uncollectedFees0) / 10 ** decimals0) * token0PriceUsd
        const fees1Usd = (Number(uncollectedFees1) / 10 ** decimals1) * token1PriceUsd
        const feesValueUsd = fees0Usd + fees1Usd
        const apr = null
        return {
            apr,
            totalValueUsd: totalValueUsd > 0 ? totalValueUsd : null,
            feesValueUsd: feesValueUsd > 0 ? feesValueUsd : null,
        }
    }, [
        position,
        amount0,
        amount1,
        uncollectedFees0,
        uncollectedFees1,
        token0PriceUsd,
        token1PriceUsd,
    ])
}
