'use client'

import { useMemo } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from 'wagmi'
import type { Address, Hex } from 'viem'
import type { Token } from '@/types/tokens'
import type { SwapParams, SwapResult } from '@/types/swap'
import { getV3Config } from '@/lib/dex-config'
import { useSwapStore } from '@/store/swap-store'
import { UNISWAP_V3_SWAP_ROUTER_ABI } from '@/lib/abis/uniswap-v3-swap-router'
import {
    buildSwapParams,
    buildMulticallSwapToNative,
    buildMultiHopSwapParams,
    buildMulticallMultiHopSwapToNative,
} from '@/services/dex/uniswap-v3'
import type { SwapRoute } from '@/types/routing'
import { toastError } from '@/lib/toast'
import { isNativeToken, shouldSkipUnwrap } from '@/lib/wagmi'
import { getWrapOperation, getWrappedNativeAddress } from '@/services/tokens'
import { WETH9_ABI } from '@/lib/abis/weth9'

export interface UseUniV3SwapExecutionParams {
    tokenIn: Token
    tokenOut: Token
    amountIn: bigint
    amountOutMinimum: bigint
    recipient: Address
    slippage: number // in percentage (0.5, 1, etc.)
    deadlineMinutes: number
    fee: number
    route?: SwapRoute
    skipSimulation?: boolean // Skip simulation during approval phase
}

export interface UseUniV3SwapExecutionResult {
    swap: () => void
    result: SwapResult | null
    isPreparing: boolean
    isExecuting: boolean
    isConfirming: boolean
    isSuccess: boolean
    isError: boolean
    error: Error | null
    hash: Address | undefined
    simulationError: Error | null
    isWrapUnwrap: boolean
}

export function useUniV3SwapExecution({
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMinimum,
    recipient,
    slippage,
    deadlineMinutes,
    fee,
    route,
    skipSimulation = false,
}: UseUniV3SwapExecutionParams): UseUniV3SwapExecutionResult {
    const { selectedDex } = useSwapStore()
    const dexConfig = getV3Config(tokenIn.chainId, selectedDex)
    const wrapOperation = useMemo(() => {
        return getWrapOperation(tokenIn, tokenOut)
    }, [tokenIn, tokenOut])
    const isNativeInput = isNativeToken(tokenIn.address as Address)
    const isNativeOutput = isNativeToken(tokenOut.address as Address)
    const skipUnwrap = isNativeOutput && shouldSkipUnwrap(tokenIn.chainId)
    const contractCall = useMemo(() => {
        const swapParams: SwapParams = {
            tokenIn: tokenIn.address as Address,
            tokenOut: tokenOut.address as Address,
            amountIn,
            amountOutMinimum,
            recipient,
            slippageTolerance: Math.floor(slippage * 100), // Convert to basis points
            deadline: Math.floor(Date.now() / 1000) + deadlineMinutes * 60,
        }

        if (wrapOperation) {
            const wrappedAddress = getWrappedNativeAddress(tokenIn.chainId)

            if (wrapOperation === 'wrap') {
                return {
                    address: wrappedAddress,
                    abi: WETH9_ABI,
                    functionName: 'deposit' as const,
                    args: [] as const,
                    value: amountIn,
                }
            } else {
                return {
                    address: wrappedAddress,
                    abi: WETH9_ABI,
                    functionName: 'withdraw' as const,
                    args: [amountIn] as [bigint],
                    value: undefined,
                }
            }
        }

        const txValue = isNativeInput ? amountIn : undefined
        if (route?.isMultiHop && route.path.length > 2 && route.fees) {
            if (isNativeOutput && !skipUnwrap) {
                const multicallData = buildMulticallMultiHopSwapToNative(
                    route.path,
                    route.fees,
                    amountIn,
                    amountOutMinimum,
                    recipient,
                    tokenIn.chainId
                )
                return {
                    functionName: 'multicall' as const,
                    args: [multicallData] as [Hex[]],
                    value: txValue,
                }
            } else {
                const params = buildMultiHopSwapParams(
                    route.path,
                    route.fees,
                    amountIn,
                    amountOutMinimum,
                    recipient,
                    tokenIn.chainId
                )
                return {
                    functionName: 'exactInput' as const,
                    args: [params] as const,
                    value: txValue,
                }
            }
        }
        if (isNativeOutput && !skipUnwrap) {
            const multicallData = buildMulticallSwapToNative(swapParams, fee, tokenIn.chainId)
            return {
                functionName: 'multicall' as const,
                args: [multicallData] as [Hex[]],
                value: txValue,
            }
        } else {
            const params = buildSwapParams(swapParams, fee, tokenIn.chainId)
            return {
                functionName: 'exactInputSingle' as const,
                args: [params] as const,
                value: txValue,
            }
        }
    }, [
        wrapOperation,
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMinimum,
        recipient,
        slippage,
        deadlineMinutes,
        fee,
        isNativeInput,
        isNativeOutput,
        skipUnwrap,
        route,
        skipSimulation,
    ])
    const {
        data: simulationData,
        isLoading: isPreparing,
        error: simulationError,
    } = useSimulateContract(
        (wrapOperation
            ? {
                  address: (contractCall as { address: Address }).address,
                  abi: WETH9_ABI,
                  functionName:
                      wrapOperation === 'wrap' ? ('deposit' as const) : ('withdraw' as const),
                  args: wrapOperation === 'wrap' ? ([] as const) : ([amountIn] as const),
                  value: wrapOperation === 'wrap' ? amountIn : undefined,
                  chainId: tokenIn.chainId,
                  query: {
                      enabled: amountIn > 0n && !skipSimulation,
                  },
              }
            : {
                  address: dexConfig?.swapRouter,
                  abi: UNISWAP_V3_SWAP_ROUTER_ABI,
                  functionName: contractCall.functionName,
                  args: contractCall.args,
                  value: contractCall.value,
                  chainId: tokenIn.chainId,
                  query: {
                      enabled: amountIn > 0n && !!dexConfig && !skipSimulation,
                  },
              }) as any // eslint-disable-line @typescript-eslint/no-explicit-any -- complex conditional type union
    )
    const {
        data: hash,
        writeContract: swap,
        isPending: isExecuting,
        isError,
        error,
    } = useWriteContract()
    const { isSuccess, isPending: isConfirming } = useWaitForTransactionReceipt({
        hash,
    })
    const executeSwap = () => {
        if (!dexConfig && !wrapOperation) {
            toastError('DEX config not found for this chain')
            return
        }
        if (!simulationData?.request) {
            toastError('Swap simulation failed. Please try again.')
            return
        }
        swap({
            ...simulationData.request,
        })
    }
    return {
        swap: executeSwap,
        result: null,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        isError,
        error: error as Error | null,
        hash,
        simulationError: simulationError as Error | null,
        isWrapUnwrap: !!wrapOperation,
    }
}
