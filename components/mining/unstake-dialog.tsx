'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUnstakeAndWithdraw } from '@/hooks/useStaking'
import { usePendingRewards } from '@/hooks/useRewards'
import { formatRewardAmount } from '@/lib/format'
import { formatTimeRemaining } from '@/services/mining/incentives'
import { toastSuccess, toastError } from '@/lib/toast'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { markUnstaked } from '@/lib/optimistic-deposits'
import { TxFlowDialog, actionStep } from '@/components/ui/tx-flow-dialog'
import { TxStageFlow, type TxSide } from '@/components/ui/tx-stage'
import type { StakedPosition } from '@/types/earn'

interface UnstakeDialogProps {
    open: boolean
    stakedPosition: StakedPosition | null
    onClose: () => void
    onSuccess?: () => void
}

export function UnstakeDialog({
    open,
    stakedPosition: selectedStakedPosition,
    onClose,
    onSuccess,
}: UnstakeDialogProps) {
    const { address } = useAccount()
    const chainId = useChainId()
    const [txOpen, setTxOpen] = useState(false)
    const { position, incentive } = selectedStakedPosition ?? { position: null, incentive: null }
    const program = incentive?.program ?? 'v3'
    const { reward: pendingRewards, isLoading: isLoadingRewards } = usePendingRewards(
        incentive,
        position?.tokenId,
        program
    )
    const tokenIds = useMemo(() => (position ? [position.tokenId] : []), [position])
    const { unstake, withdraw } = useUnstakeAndWithdraw(tokenIds, incentive, address, program)
    // Read at click: once the unstake lands the pending reward reads zero, and the claim
    // step's success frame should still show what was paid out.
    const [flowReward, setFlowReward] = useState('')
    useOnTxSuccess(open, withdraw.isSuccess, withdraw.hash, () => {
        if (address && position) {
            markUnstaked(chainId, address, position.tokenId)
        }
        toastSuccess('Position unstaked and withdrawn')
        // The tx dialog owns the success frame and closes both from its Done button.
        onSuccess?.()
    })
    const error = unstake.error ?? withdraw.error
    useEffect(() => {
        if (error) {
            toastError(error)
        }
    }, [error])
    if (!selectedStakedPosition || !position || !incentive) return null
    const isLoading = unstake.isPreparing || unstake.isExecuting || unstake.isConfirming
    const getButtonText = () => {
        if (unstake.isPreparing) return 'Preparing...'
        if (unstake.isExecuting) return 'Confirm in wallet...'
        if (unstake.isConfirming) return 'Unstaking...'
        return 'Unstake & Claim'
    }
    const formattedRewards = formatRewardAmount(pendingRewards, incentive.rewardTokenInfo.decimals)
    const handleUnstake = () => {
        setFlowReward(formattedRewards)
        setTxOpen(true)
        unstake.run()
    }
    const positionSide: TxSide = {
        kind: 'position',
        tokenId: position.tokenId,
        feeTier: position.fee,
        inRange: position.inRange,
        token0: position.token0Info,
        token1: position.token1Info,
    }
    const txSteps = [
        actionStep({
            label: 'Unstake & claim rewards',
            flags: {
                isPending: unstake.isPreparing || unstake.isExecuting,
                isConfirming: unstake.isConfirming,
                isSuccess: unstake.isSuccess,
                isError: !!unstake.error,
                error: unstake.error,
                simulationError: unstake.simulationError,
                hash: unstake.hash,
            },
            run: unstake.run,
            renderStage: (phase) => (
                <TxStageFlow
                    phase={phase}
                    chainId={chainId}
                    hash={unstake.hash}
                    from={positionSide}
                    to={{
                        kind: 'token',
                        token: incentive.rewardTokenInfo,
                        amount: flowReward || formattedRewards,
                    }}
                />
            ),
        }),
        actionStep({
            label: `Withdraw position #${position.tokenId.toString()}`,
            flags: {
                isPending: withdraw.isPreparing || withdraw.isExecuting,
                isConfirming: withdraw.isConfirming,
                isSuccess: withdraw.isSuccess,
                isError: !!withdraw.error,
                error: withdraw.error,
                simulationError: withdraw.simulationError,
                hash: withdraw.hash,
            },
            run: withdraw.run,
            autoRun: withdraw.canRun,
            renderStage: (phase) => (
                <TxStageFlow
                    phase={phase}
                    chainId={chainId}
                    hash={withdraw.hash}
                    from={{ kind: 'contract', label: 'Farm staker', amount: 'Unstaked' }}
                    to={positionSide}
                />
            ),
        }),
    ]
    return (
        <>
            <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Unstake Position</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-lg font-medium">
                                {position.token0Info.symbol} / {position.token1Info.symbol}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Position #{position.tokenId.toString()}
                            </div>
                        </div>
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Mining Pool</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                        {incentive.poolToken0.symbol} /{' '}
                                        {incentive.poolToken1.symbol}
                                    </span>
                                    {incentive.isActive ? (
                                        <Badge
                                            variant="outline"
                                            className="bg-positive/10 text-positive border-positive/20"
                                        >
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            Ended
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                    Time Remaining
                                </span>
                                <span className="font-medium">
                                    {formatTimeRemaining(incentive.endTime)}
                                </span>
                            </div>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground mb-1">
                                Pending Rewards
                            </div>
                            <div className="text-2xl font-bold">
                                {isLoadingRewards ? (
                                    <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                    <>
                                        {formattedRewards} {incentive.rewardTokenInfo.symbol}
                                    </>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Claimed when you unstake, then the position is withdrawn in a second
                                signature
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button size="lg" onClick={handleUnstake} disabled={isLoading}>
                            {getButtonText()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Its own Radix root, outside this one, so the two modals don't fight over focus. */}
            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="Unstake position"
                steps={txSteps}
                chainId={chainId}
                onDone={onClose}
            />
        </>
    )
}
