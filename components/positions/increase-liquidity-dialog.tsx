'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIncreaseLiquidity } from '@/hooks/useLiquidity'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { usePool } from '@/hooks/usePools'
import { getDexes } from '@coshi190/juno-moneta-sdk'
import { computeDependentAmount } from '@/lib/liquidity-helpers'
import { isInRange } from '@/lib/tick-math'
import { getChainMetadata } from '@/lib/wagmi'
import { parseTokenAmount, formatBalance, formatTokenAmount } from '@/lib/tokens'
import { toastError } from '@/lib/toast'
import { toast } from 'sonner'
import { TxFlowDialog, actionStep, approvalStep, type TxStep } from '@/components/ui/tx-flow-dialog'
import { TxStageRecord } from '@/components/ui/tx-stage'
import type { PositionWithTokens } from '@/types/earn'

interface IncreaseLiquidityDialogProps {
    open: boolean
    position: PositionWithTokens | null
    onClose: () => void
    onSuccess?: () => void
}

export function IncreaseLiquidityDialog({
    open,
    position: selectedPosition,
    onClose,
    onSuccess,
}: IncreaseLiquidityDialogProps) {
    const { address } = useAccount()
    const chainId = useChainId()
    const dexConfig = getDexes(chainId, 'v3')[0]
    const [amount0, setAmount0] = useState('')
    const [amount1, setAmount1] = useState('')
    const [activeInput, setActiveInput] = useState<'token0' | 'token1' | null>(null)
    const handledHashRef = useRef<string | null>(null)
    const [txOpen, setTxOpen] = useState(false)
    // Frozen when the flow opens: an approval landing mid-flow flips needsApproval to
    // false, and rebuilding from that would delete the step the user is looking at.
    const [flowApprovals, setFlowApprovals] = useState({ token0: false, token1: false })
    const { pool } = usePool(
        selectedPosition?.token0Info ?? null,
        selectedPosition?.token1Info ?? null,
        selectedPosition?.fee ?? 0,
        chainId
    )
    const { balance: balance0 } = useTokenBalance({
        token: selectedPosition?.token0Info ?? null,
        address,
    })
    const { balance: balance1 } = useTokenBalance({
        token: selectedPosition?.token1Info ?? null,
        address,
    })
    const amount0Parsed =
        amount0 && selectedPosition
            ? parseTokenAmount(amount0, selectedPosition.token0Info.decimals)
            : 0n
    const amount1Parsed =
        amount1 && selectedPosition
            ? parseTokenAmount(amount1, selectedPosition.token1Info.decimals)
            : 0n
    const {
        needsApproval: needsApproval0,
        approve: approve0,
        isApproving: isApproving0,
        isConfirming: isConfirming0,
        isSuccess: isApproved0,
        isError: isApproveError0,
        error: approveError0,
        hash: approveHash0,
    } = useTokenApproval({
        token: selectedPosition?.token0Info ?? null,
        owner: address,
        spender: dexConfig?.positionManager,
        amountToApprove: amount0Parsed,
    })
    const {
        needsApproval: needsApproval1,
        approve: approve1,
        isApproving: isApproving1,
        isConfirming: isConfirming1,
        isSuccess: isApproved1,
        isError: isApproveError1,
        error: approveError1,
        hash: approveHash1,
    } = useTokenApproval({
        token: selectedPosition?.token1Info ?? null,
        owner: address,
        spender: dexConfig?.positionManager,
        amountToApprove: amount1Parsed,
    })
    const {
        increase,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        error,
        simulationError,
        hash,
    } = useIncreaseLiquidity(
        selectedPosition?.tokenId,
        amount0Parsed,
        amount1Parsed,
        selectedPosition ?? null,
        50, // 0.5% slippage
        20 // 20 minutes deadline
    )
    useEffect(() => {
        if (!pool || !selectedPosition) return
        const sqrtPriceX96 = pool.sqrtPriceX96
        // Position rows come from the indexer in canonical pool order, so this is false today.
        // Deriving it keeps the dependent amount correct if the position source ever changes.
        const isPoolReversed =
            selectedPosition.token0Info.address.toLowerCase() !== pool.token0.address.toLowerCase()
        const range = {
            sqrtPriceX96,
            tickLower: selectedPosition.tickLower,
            tickUpper: selectedPosition.tickUpper,
            invert: isPoolReversed,
        }
        if (activeInput === 'token0') {
            if (!amount0) {
                setAmount1('')
                return
            }
            if (amount0Parsed > 0n) {
                const calculatedAmount1 = computeDependentAmount({
                    ...range,
                    amount: amount0Parsed,
                    side: 'token0',
                })
                setAmount1(
                    calculatedAmount1 > 0n
                        ? formatTokenAmount(calculatedAmount1, selectedPosition.token1Info.decimals)
                        : ''
                )
            } else {
                setAmount1('')
            }
        } else if (activeInput === 'token1') {
            if (!amount1) {
                setAmount0('')
                return
            }
            if (amount1Parsed > 0n) {
                const calculatedAmount0 = computeDependentAmount({
                    ...range,
                    amount: amount1Parsed,
                    side: 'token1',
                })
                setAmount0(
                    calculatedAmount0 > 0n
                        ? formatTokenAmount(calculatedAmount0, selectedPosition.token0Info.decimals)
                        : ''
                )
            } else {
                setAmount0('')
            }
        }
    }, [activeInput, amount0, amount1, pool, selectedPosition, amount0Parsed, amount1Parsed])
    useEffect(() => {
        if (isSuccess && hash && hash !== handledHashRef.current) {
            handledHashRef.current = hash
            const meta = getChainMetadata(chainId)
            const explorerUrl = meta?.explorer
                ? `${meta.explorer}/tx/${hash}`
                : `https://etherscan.io/tx/${hash}`
            toast.success('Liquidity added successfully!', {
                action: {
                    label: 'View Transaction',
                    onClick: () => window.open(explorerUrl, '_blank', 'noopener,noreferrer'),
                },
            })
            // The tx dialog owns the success frame and closes both from its Done button.
            onSuccess?.()
        }
    }, [isSuccess, hash, chainId, onSuccess])
    useEffect(() => {
        if (error) {
            toastError(error)
        }
    }, [error])
    useEffect(() => {
        if (simulationError) {
            toastError(`Simulation failed: ${simulationError.message}`)
        }
    }, [simulationError])
    const isLoading =
        isPreparing ||
        isExecuting ||
        isConfirming ||
        isApproving0 ||
        isApproving1 ||
        isConfirming0 ||
        isConfirming1
    const txSteps: TxStep[] = []
    if (selectedPosition) {
        if (flowApprovals.token0) {
            txSteps.push(
                approvalStep({
                    token: selectedPosition.token0Info,
                    spenderLabel: 'Position Manager',
                    spender: dexConfig?.positionManager,
                    chainId,
                    run: approve0,
                    flags: {
                        isPending: isApproving0,
                        isConfirming: isConfirming0,
                        isSuccess: isApproved0,
                        isError: isApproveError0,
                        error: approveError0,
                        hash: approveHash0,
                    },
                })
            )
        }
        if (flowApprovals.token1) {
            txSteps.push(
                approvalStep({
                    token: selectedPosition.token1Info,
                    spenderLabel: 'Position Manager',
                    spender: dexConfig?.positionManager,
                    chainId,
                    run: approve1,
                    flags: {
                        isPending: isApproving1,
                        isConfirming: isConfirming1,
                        isSuccess: isApproved1,
                        isError: isApproveError1,
                        error: approveError1,
                        hash: approveHash1,
                    },
                })
            )
        }
        const sym0 = selectedPosition.token0Info.symbol
        const sym1 = selectedPosition.token1Info.symbol
        txSteps.push(
            actionStep({
                label: 'Add liquidity',
                flags: {
                    isPending: isPreparing || isExecuting,
                    isConfirming,
                    isSuccess,
                    isError: !!error,
                    error,
                    simulationError,
                    hash,
                },
                run: increase,
                renderStage: (phase) => (
                    <TxStageRecord
                        phase={phase}
                        chainId={chainId}
                        hash={hash}
                        rows={[
                            ['Position', `#${selectedPosition.tokenId.toString()}`],
                            ['Pair', `${sym0} / ${sym1}`],
                            ['Deposit', `${amount0 || '0'} ${sym0} + ${amount1 || '0'} ${sym1}`],
                        ]}
                    />
                ),
            })
        )
    }

    const handleSubmit = () => {
        setFlowApprovals({ token0: needsApproval0, token1: needsApproval1 })
        setTxOpen(true)
        if (needsApproval0) approve0()
        else if (needsApproval1) approve1()
        else increase()
    }
    const insufficientSymbol = [
        amount0Parsed > balance0 && selectedPosition?.token0Info.symbol,
        amount1Parsed > balance1 && selectedPosition?.token1Info.symbol,
    ]
        .filter(Boolean)
        .join(' & ')
    const getButtonText = () => {
        if (isApproving0) return `Approving ${selectedPosition?.token0Info.symbol}...`
        if (isConfirming0) return `Confirming ${selectedPosition?.token0Info.symbol} approval...`
        if (isApproving1) return `Approving ${selectedPosition?.token1Info.symbol}...`
        if (isConfirming1) return `Confirming ${selectedPosition?.token1Info.symbol} approval...`
        if (insufficientSymbol) return `Insufficient ${insufficientSymbol} balance`
        if (needsApproval0) return `Approve ${selectedPosition?.token0Info.symbol}`
        if (needsApproval1) return `Approve ${selectedPosition?.token1Info.symbol}`
        if (isPreparing) return 'Preparing...'
        if (isExecuting) return 'Confirm in wallet...'
        if (isConfirming) return 'Adding liquidity...'
        return 'Add Liquidity'
    }
    const isButtonDisabled = () => {
        if (isLoading) return true
        if (!selectedPosition) return true
        if (!amount0 && !amount1) return true
        if (insufficientSymbol) return true
        if (!pool) return true
        return false
    }
    if (!selectedPosition) return null
    const inRange = pool
        ? isInRange(pool.tick, selectedPosition.tickLower, selectedPosition.tickUpper)
        : false
    return (
        <>
            <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Liquidity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-lg font-medium">
                                {selectedPosition.token0Info.symbol} /{' '}
                                {selectedPosition.token1Info.symbol}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <span>Position #{selectedPosition.tokenId.toString()}</span>
                                {inRange ? (
                                    <span className="text-positive">• In Range</span>
                                ) : (
                                    <span>• Out of Range</span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>{selectedPosition.token0Info.symbol}</Label>
                                    <span className="text-sm text-muted-foreground">
                                        Balance:{' '}
                                        {balance0
                                            ? formatBalance(
                                                  balance0,
                                                  selectedPosition.token0Info.decimals
                                              )
                                            : '0'}
                                    </span>
                                </div>
                                <Input
                                    type="number"
                                    step="any"
                                    value={amount0}
                                    onChange={(e) => {
                                        setActiveInput('token0')
                                        setAmount0(e.target.value)
                                    }}
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>{selectedPosition.token1Info.symbol}</Label>
                                    <span className="text-sm text-muted-foreground">
                                        Balance:{' '}
                                        {balance1
                                            ? formatBalance(
                                                  balance1,
                                                  selectedPosition.token1Info.decimals
                                              )
                                            : '0'}
                                    </span>
                                </div>
                                <Input
                                    type="number"
                                    step="any"
                                    value={amount1}
                                    onChange={(e) => {
                                        setActiveInput('token1')
                                        setAmount1(e.target.value)
                                    }}
                                    placeholder="0.0"
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isButtonDisabled()}
                        >
                            {getButtonText()}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Its own Radix root, outside this one, so the two modals don't fight over focus. */}
            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="Add liquidity"
                steps={txSteps}
                chainId={chainId}
                onDone={() => {
                    setAmount0('')
                    setAmount1('')
                    setActiveInput(null)
                    onClose()
                }}
            />
        </>
    )
}
