'use client'

import { useMemo } from 'react'
import { useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import type { Address } from 'viem'
import {
    PUMP_CORE_NATIVE_ADDRESS,
    PUMP_CORE_NATIVE_ABI,
    PUMP_CORE_NATIVE_CHAIN_ID,
} from '@/lib/abis/pump-core-native'
import { calculateSellOutput, calculateMinOutput } from '@/services/launchpad'
import { useLaunchpadStore } from '@/store/launchpad-store'

interface UseBondingCurveSellParams {
    tokenAddr: Address | null
    tokenAmount: bigint
    nativeReserve: bigint
    tokenReserve: bigint
    virtualAmount: bigint
    enabled?: boolean
}

interface UseBondingCurveSellResult {
    sell: () => void
    expectedOut: bigint
    minNativeOut: bigint
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    isError: boolean
    error: Error | null
    hash: Address | undefined
}

export function useBondingCurveSell({
    tokenAddr,
    tokenAmount,
    nativeReserve,
    tokenReserve,
    virtualAmount,
    enabled = true,
}: UseBondingCurveSellParams): UseBondingCurveSellResult {
    const { settings } = useLaunchpadStore()

    const expectedOut = useMemo(
        () => calculateSellOutput(tokenAmount, nativeReserve, tokenReserve, virtualAmount),
        [tokenAmount, nativeReserve, tokenReserve, virtualAmount]
    )

    const minNativeOut = useMemo(
        () => calculateMinOutput(expectedOut, settings.slippageBps),
        [expectedOut, settings.slippageBps]
    )

    const { data: simulationData, isLoading: isPreparing } = useSimulateContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'sell',
        args: tokenAddr ? [tokenAddr, tokenAmount, minNativeOut] : undefined,
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
        query: {
            enabled: !!tokenAddr && tokenAmount > 0n && enabled,
        },
    })

    const { data: hash, writeContract, isPending: isExecuting, isError, error } = useWriteContract()

    const { isSuccess, isPending: isConfirming } = useWaitForTransactionReceipt({
        hash,
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    const sell = () => {
        if (!simulationData?.request) return
        writeContract(simulationData.request)
    }

    return {
        sell,
        expectedOut,
        minNativeOut,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        isError,
        error: error as Error | null,
        hash,
    }
}
