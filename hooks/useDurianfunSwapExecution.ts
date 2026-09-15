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
import { maxUint256, zeroAddress, type Address } from 'viem'
import { durianfunMarketAbi, durianfunErc20Abi } from '@/services/launchpad/durianfun'
import { calculateMinOutput } from '@/services/dex/slippage'
import { useSwapStore } from '@/store/swap-store'

interface UseDurianfunSwapExecutionParams {
    side: 'buy' | 'sell'
    tokenAddr: Address | null
    marketAddr: Address | null
    amount: bigint
    chainId: number
    /** Junoswap's own address — every Durianfun curve swap accepts a referrer and pays it a fee share. */
    referrer?: Address
    enabled?: boolean
}

interface UseDurianfunSwapExecutionResult {
    execute: () => void
    canExecute: boolean
    expectedOut: bigint
    minOut: bigint
    sellBlockedReason: string | null
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    isError: boolean
    error: Error | null
    hash: Address | undefined
    /** Sell only: token allowance to the market contract must cover `amount` before `execute()` can swap. */
    needsApproval: boolean
    approve: () => void
    isApproving: boolean
    isApproveConfirming: boolean
}

export function useDurianfunSwapExecution({
    side,
    tokenAddr,
    marketAddr,
    amount,
    chainId,
    referrer = zeroAddress,
    enabled = true,
}: UseDurianfunSwapExecutionParams): UseDurianfunSwapExecutionResult {
    const isBuy = side === 'buy'
    const { settings } = useSwapStore()
    const slippageBps = Math.round(settings.slippage * 100)
    const { address } = useAccount()
    const publicClient = usePublicClient({ chainId })

    const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
        address: tokenAddr ?? undefined,
        abi: durianfunErc20Abi,
        functionName: 'allowance',
        args: [address ?? zeroAddress, marketAddr ?? zeroAddress],
        chainId,
        query: { enabled: !isBuy && !!tokenAddr && !!address && !!marketAddr },
    })

    const {
        data: approveHash,
        writeContract: writeApprove,
        isPending: isApproving,
    } = useWriteContract()

    const { data: approveReceipt } = useQuery({
        queryKey: ['durianfun-approve-receipt', approveHash],
        queryFn: async () => {
            if (!approveHash || !publicClient) return null
            const r = await publicClient.getTransactionReceipt({ hash: approveHash })
            if (r) refetchAllowance()
            return r
        },
        enabled: !!approveHash && !!publicClient,
        refetchInterval: (query) => (query.state.data ? false : 2000),
    })
    const isApproveConfirming = !!approveHash && !approveReceipt

    const approve = () => {
        if (!tokenAddr || !marketAddr) return
        writeApprove({
            address: tokenAddr,
            abi: durianfunErc20Abi,
            functionName: 'approve',
            args: [marketAddr, maxUint256],
            chainId,
        })
    }

    const { data: buyQuote } = useReadContract({
        address: marketAddr ?? undefined,
        abi: durianfunMarketAbi,
        functionName: 'quoteBuy',
        args: [amount],
        chainId,
        query: { enabled: isBuy && !!marketAddr && amount > 0n && enabled },
    })

    const { data: sellQuote } = useReadContract({
        address: marketAddr ?? undefined,
        abi: durianfunMarketAbi,
        functionName: 'quoteSell',
        args: [amount],
        chainId,
        query: { enabled: !isBuy && !!marketAddr && amount > 0n && enabled },
    })

    const expectedOut = isBuy ? (buyQuote?.[0] ?? 0n) : (sellQuote?.[0] ?? 0n)
    const sellExecutable = sellQuote ? sellQuote[2] : true
    const sellBlockedReason = !isBuy && sellQuote && !sellQuote[2] ? sellQuote[3] : null

    const minOut = useMemo(
        () => calculateMinOutput(expectedOut, slippageBps),
        [expectedOut, slippageBps]
    )

    // Not memoized: a frozen deadline would revert the tx once real time passes it. Recomputed
    // on every render, which is cheap and happens on every amount/quote/allowance update anyway.
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(settings.deadlineMinutes) * 60n

    const needsApproval = !isBuy && !!tokenAddr && amount > 0n && allowance < amount

    const { data: simulationData, isLoading: isPreparing } = useSimulateContract({
        address: marketAddr ?? undefined,
        abi: durianfunMarketAbi,
        functionName: isBuy ? 'swapExactKubForTokens' : 'swapExactTokensForKub',
        args: isBuy
            ? [minOut, address ?? zeroAddress, referrer, deadline]
            : [amount, minOut, address ?? zeroAddress, referrer, deadline],
        value: isBuy ? amount : undefined,
        chainId,
        query: {
            enabled:
                !!marketAddr &&
                !!address &&
                amount > 0n &&
                (isBuy ? true : !needsApproval && sellExecutable) &&
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

    const { data: receipt } = useQuery({
        queryKey: ['durianfun-swap-receipt', hash],
        queryFn: async () => {
            if (!hash || !publicClient) return null
            return publicClient.getTransactionReceipt({ hash })
        },
        enabled: !!hash && !!publicClient,
        refetchInterval: (query) => (query.state.data ? false : 2000),
    })

    const isConfirming = !!hash && !receipt
    const isSuccess = !!receipt && receipt.status === 'success'
    const isError = isWriteError || (!!receipt && receipt.status === 'reverted')
    const error =
        writeError ||
        (isError && receipt?.status === 'reverted' ? new Error('Transaction reverted') : null)

    const canExecute = !!simulationData?.request

    const execute = () => {
        if (!simulationData?.request) return
        writeContract(simulationData.request)
    }

    return {
        execute,
        canExecute,
        expectedOut,
        minOut,
        sellBlockedReason,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        isError,
        error: error as Error | null,
        hash,
        needsApproval,
        approve,
        isApproving,
        isApproveConfirming,
    }
}
