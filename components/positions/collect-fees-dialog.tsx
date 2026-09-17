'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useCollectFees } from '@/hooks/useLiquidity'
import { formatTokenAmount } from '@/lib/tokens'
import { toastSuccess, toastError } from '@/lib/toast'
import { TxFlowDialog, actionStep } from '@/components/ui/tx-flow-dialog'
import { TxStageRecord } from '@/components/ui/tx-stage'
import type { PositionWithTokens } from '@/types/earn'

interface CollectFeesDialogProps {
    open: boolean
    position: PositionWithTokens | null
    onClose: () => void
    onSuccess?: () => void
}

export function CollectFeesDialog({
    open,
    position: selectedPosition,
    onClose,
    onSuccess,
}: CollectFeesDialogProps) {
    const { address } = useAccount()
    const chainId = useChainId()
    const [txOpen, setTxOpen] = useState(false)
    const {
        collect,
        hasFees,
        fees0,
        fees1,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        error,
        hash,
    } = useCollectFees(selectedPosition, address)
    const handledHashRef = useRef<string | null>(null)
    useEffect(() => {
        if (isSuccess && hash && hash !== handledHashRef.current) {
            handledHashRef.current = hash
            toastSuccess('Fees collected successfully!')
            // The tx dialog owns the success frame and closes both from its Done button.
            onSuccess?.()
        }
    }, [isSuccess, hash, onSuccess])
    useEffect(() => {
        if (error) {
            toastError(error)
        }
    }, [error])
    if (!selectedPosition) return null
    const isLoading = isPreparing || isExecuting || isConfirming
    const sym0 = selectedPosition.token0Info.symbol
    const sym1 = selectedPosition.token1Info.symbol
    const handleCollect = () => {
        setTxOpen(true)
        collect()
    }
    const txSteps = [
        actionStep({
            label: 'Collect fees',
            flags: {
                isPending: isPreparing || isExecuting,
                isConfirming,
                isSuccess,
                isError: !!error,
                error,
                hash,
            },
            run: collect,
            renderStage: (phase) => (
                <TxStageRecord
                    phase={phase}
                    chainId={chainId}
                    hash={hash}
                    rows={[
                        ['Position', `#${selectedPosition.tokenId.toString()}`],
                        ['Pair', `${sym0} / ${sym1}`],
                        [
                            'Fees',
                            `${formatTokenAmount(fees0, selectedPosition.token0Info.decimals)} ${sym0} + ${formatTokenAmount(fees1, selectedPosition.token1Info.decimals)} ${sym1}`,
                        ],
                    ]}
                />
            ),
        }),
    ]
    const getButtonText = () => {
        if (isPreparing) return 'Preparing...'
        if (isExecuting) return 'Confirm in wallet...'
        if (isConfirming) return 'Collecting fees...'
        return 'Collect Fees'
    }
    return (
        <>
            <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Collect Fees</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-lg font-medium">
                                {selectedPosition.token0Info.symbol} /{' '}
                                {selectedPosition.token1Info.symbol}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Position #{selectedPosition.tokenId.toString()}
                            </div>
                        </div>
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                            <div className="text-sm text-muted-foreground">Fees to collect:</div>
                            <div className="flex justify-between items-center">
                                <span className="font-medium">
                                    {selectedPosition.token0Info.symbol}
                                </span>
                                <span className="text-lg font-bold">
                                    {formatTokenAmount(fees0, selectedPosition.token0Info.decimals)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-medium">
                                    {selectedPosition.token1Info.symbol}
                                </span>
                                <span className="text-lg font-bold">
                                    {formatTokenAmount(fees1, selectedPosition.token1Info.decimals)}
                                </span>
                            </div>
                        </div>
                        {!hasFees && (
                            <EmptyState title="No fees to collect at this time." className="py-2" />
                        )}
                    </div>
                    <DialogFooter>
                        <Button size="lg" onClick={handleCollect} disabled={isLoading || !hasFees}>
                            {getButtonText()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Its own Radix root, outside this one, so the two modals don't fight over focus. */}
            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="Collect fees"
                steps={txSteps}
                chainId={chainId}
                onDone={() => {
                    onClose()
                }}
            />
        </>
    )
}
