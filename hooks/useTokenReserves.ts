'use client'

import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import {
    PUMP_CORE_NATIVE_ADDRESS,
    PUMP_CORE_NATIVE_ABI,
    PUMP_CORE_NATIVE_CHAIN_ID,
} from '@/lib/abis/pump-core-native'

interface UseTokenReservesParams {
    tokenAddr: Address | null
    chainId?: number
}

interface UseTokenReservesResult {
    nativeReserve: bigint
    tokenReserve: bigint
    isGraduated: boolean
    virtualAmount: bigint
    graduationAmount: bigint
    isLoading: boolean
    refetch: () => void
}

export function useTokenReserves({
    tokenAddr,
    chainId = PUMP_CORE_NATIVE_CHAIN_ID,
}: UseTokenReservesParams): UseTokenReservesResult {
    const {
        data: reserveData,
        isLoading: isLoadingReserve,
        refetch: refetchReserve,
    } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'pumpReserve',
        args: tokenAddr ? [tokenAddr] : undefined,
        chainId,
        query: {
            enabled: !!tokenAddr,
        },
    })

    const { data: isGraduatedData, isLoading: isLoadingGraduated } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'isGraduate',
        args: tokenAddr ? [tokenAddr] : undefined,
        chainId,
        query: {
            enabled: !!tokenAddr,
        },
    })

    const { data: virtualAmountData, isLoading: isLoadingVirtual } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'virtualAmount',
        chainId,
        query: {
            enabled: !!tokenAddr,
        },
    })

    const { data: graduationAmountData } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'graduationAmount',
        chainId,
        query: {
            enabled: !!tokenAddr,
        },
    })

    const reserve = reserveData as [bigint, bigint] | undefined

    return {
        nativeReserve: reserve?.[0] ?? 0n,
        tokenReserve: reserve?.[1] ?? 0n,
        isGraduated: isGraduatedData ?? false,
        virtualAmount: virtualAmountData ?? 0n,
        graduationAmount: graduationAmountData ?? 0n,
        isLoading: isLoadingReserve || isLoadingGraduated || isLoadingVirtual,
        refetch: refetchReserve,
    }
}
