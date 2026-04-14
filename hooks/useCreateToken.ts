'use client'

import { useMemo, useEffect, useState } from 'react'
import { useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import {
    PUMP_CORE_NATIVE_ADDRESS,
    PUMP_CORE_NATIVE_ABI,
    PUMP_CORE_NATIVE_CHAIN_ID,
} from '@/lib/abis/pump-core-native'
import type { CreateTokenForm } from '@/types/launchpad'

interface UseCreateTokenParams {
    form: CreateTokenForm | null
}

interface UseCreateTokenResult {
    create: (logoOverride?: string) => void
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    isError: boolean
    error: Error | null
    hash: Address | undefined
    createdTokenAddress: Address | null
}

export function useCreateToken({ form }: UseCreateTokenParams): UseCreateTokenResult {
    const [createdTokenAddress, setCreatedTokenAddress] = useState<Address | null>(null)
    const publicClient = usePublicClient({ chainId: PUMP_CORE_NATIVE_CHAIN_ID })

    const { data: createFee } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'createFee',
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    const { data: initialNative } = useReadContract({
        address: PUMP_CORE_NATIVE_ADDRESS,
        abi: PUMP_CORE_NATIVE_ABI,
        functionName: 'initialNative',
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    const totalFee = useMemo(() => {
        if (createFee === undefined || initialNative === undefined) return 0n
        return (createFee as bigint) + (initialNative as bigint)
    }, [createFee, initialNative])

    const {
        data: hash,
        writeContract,
        isPending: isExecuting,
        isError: isWriteError,
        error: writeError,
    } = useWriteContract()

    // Poll for receipt manually (more reliable than useWaitForTransactionReceipt on custom chains)
    const { data: receipt } = useQuery({
        queryKey: ['create-token-receipt', hash],
        queryFn: async () => {
            if (!hash || !publicClient) return null
            return publicClient.getTransactionReceipt({ hash })
        },
        enabled: !!hash && !!publicClient,
        refetchInterval: (query) => {
            // Stop polling once we have a receipt
            if (query.state.data) return false
            return 2000
        },
    })

    const isConfirming = !!hash && !receipt
    const isSuccess = !!receipt && receipt.status === 'success'
    const isError = isWriteError || (!!receipt && receipt.status === 'reverted')
    const error =
        writeError ||
        (isError && receipt?.status === 'reverted' ? new Error('Transaction reverted') : null)

    // Reset token address on new tx
    useEffect(() => {
        if (!hash) setCreatedTokenAddress(null)
    }, [hash])

    const create = (logoOverride?: string) => {
        if (!form || totalFee === 0n) return
        setCreatedTokenAddress(null)
        writeContract({
            address: PUMP_CORE_NATIVE_ADDRESS,
            abi: PUMP_CORE_NATIVE_ABI,
            functionName: 'createToken',
            args: [
                form.name,
                form.symbol,
                logoOverride ?? form.logo,
                form.description,
                form.link1,
                form.link2,
                form.link3,
            ],
            value: totalFee,
            chainId: PUMP_CORE_NATIVE_CHAIN_ID,
        })
    }

    return {
        create,
        isPreparing: false,
        isExecuting,
        isConfirming,
        isSuccess,
        isError,
        error,
        hash,
        createdTokenAddress,
    }
}
