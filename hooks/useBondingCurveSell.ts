'use client'

import { useMemo } from 'react'
import {
    useAccount,
    useReadContract,
    useSimulateContract,
    useWriteContract,
    usePublicClient,
} from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { BONDING_CURVE_JUNOSWAP_ABI } from '@/lib/abis/bonding-curve-junoswap'
import { ERC20_ABI } from '@/lib/abis/erc20'
import { getAllowanceFunctionName } from '@/lib/tokens'
import { useLaunchpadContract } from '@/hooks/useLaunchpadChainId'
import { calculateSellOutput, calculateMinOutput } from '@/services/launchpad'
import { useSwapStore } from '@/store/swap-store'

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
    canSell: boolean
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
    const { settings } = useSwapStore()
    const slippageBps = Math.round(settings.slippage * 100)
    const { address } = useAccount()
    const { chainId, address: bondingCurveAddress } = useLaunchpadContract()
    const publicClient = usePublicClient({ chainId })

    // Gate the sell simulation on allowance so it re-runs after approval: the bonding curve's
    // sell() does a transferFrom that reverts in simulation while allowance is 0, and the
    // simulation's query key never changes on approval. Sharing this read's cache with
    // useTokenApproval means its post-approval refetch flips `enabled` and re-simulates.
    const { data: allowance = 0n } = useReadContract({
        address: tokenAddr ?? undefined,
        abi: ERC20_ABI,
        functionName: tokenAddr ? getAllowanceFunctionName(tokenAddr) : 'allowance',
        args: [address ?? '0x0', bondingCurveAddress ?? '0x0'],
        chainId,
        query: { enabled: !!tokenAddr && !!address && !!bondingCurveAddress },
    })

    const expectedOut = useMemo(
        () => calculateSellOutput(tokenAmount, nativeReserve, tokenReserve, virtualAmount),
        [tokenAmount, nativeReserve, tokenReserve, virtualAmount]
    )

    const minNativeOut = useMemo(
        () => calculateMinOutput(expectedOut, slippageBps),
        [expectedOut, slippageBps]
    )

    const { data: simulationData, isLoading: isPreparing } = useSimulateContract({
        address: bondingCurveAddress,
        abi: BONDING_CURVE_JUNOSWAP_ABI,
        functionName: 'sell',
        args: tokenAddr ? [tokenAddr, tokenAmount, minNativeOut] : undefined,
        chainId,
        query: {
            enabled:
                !!tokenAddr &&
                !!bondingCurveAddress &&
                tokenAmount > 0n &&
                allowance >= tokenAmount &&
                enabled,
        },
    })

    const {
        data: hash,
        writeContract,
        isPending: isExecuting,
        isError: isWriteError,
        error: writeError,
    } = useWriteContract()

    // Poll for receipt manually (more reliable than useWaitForTransactionReceipt on custom chains)
    const { data: receipt } = useQuery({
        queryKey: ['sell-receipt', hash],
        queryFn: async () => {
            if (!hash || !publicClient) return null
            return publicClient.getTransactionReceipt({ hash })
        },
        enabled: !!hash && !!publicClient,
        refetchInterval: (query) => {
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

    const canSell = !!simulationData?.request

    const sell = () => {
        if (!simulationData?.request) return
        writeContract(simulationData.request)
    }

    return {
        sell,
        canSell,
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
