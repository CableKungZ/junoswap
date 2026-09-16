'use client'

import { useEffect, useState } from 'react'
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
import { useUnstakePosition } from '@/hooks/useStaking'
import { usePendingRewards } from '@/hooks/useRewards'
import { formatRewardAmount } from '@/lib/format'
import { formatTimeRemaining } from '@/services/mining/incentives'
import { toastSuccess, toastError } from '@/lib/toast'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { markUnstaked } from '@/lib/optimistic-deposits'
import { TxFlowDialog, actionStep } from '@/components/ui/tx-flow-dialog'
import { TxStageFlow } from '@/components/ui/tx-stage'
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
    const { unstake, isPreparing, isExecuting, isConfirming, isSuccess, error, hash } =
        useUnstakePosition(position?.tokenId, incentive, address, program, true)
    useOnTxSuccess(open, isSuccess, hash, () => {
        if (address && position) {
            markUnstaked(chainId, address, position.tokenId)
        }
        toastSuccess('Position unstaked successfully!')
        // The tx dialog owns the success frame and closes both from its Done button.
        onSuccess?.()
    })
    useEffect(() => {
        if (error) {
            toastError(error)
        }
    }, [error])
    if (!selectedStakedPosition || !position || !incentive) return null
    const isLoading = isPreparing || isExecuting || isConfirming
    const getButtonText = () => {
        if (isPreparing) return 'Preparing...'
        if (isExecuting) return 'Confirm in wallet...'
        if (isConfirming) return 'Unstaking...'
        return 'Unstake & Claim'
    }
    const formattedRewards = formatRewardAmount(pendingRewards, incentive.rewardTokenInfo.decimals)
    const handleUnstake = () => {
        setTxOpen(true)
        unstake()
    }
    // One multicall: unstakeToken + claimReward + withdrawToken. The reward is what the
    // user is waiting on, so it is the side that counts up.
    const txSteps = [
        actionStep({
            label: `Unstake position #${position.tokenId.toString()}`,
            flags: {
                isPending: isPreparing || isExecuting,
                isConfirming,
                isSuccess,
                isError: !!error,
                error,
                hash,
            },
            run: unstake,
            renderStage: (phase) => (
                <TxStageFlow
                    phase={phase}
                    chainId={chainId}
                    hash={hash}
                    from={{
                        kind: 'position',
                        tokenId: position.tokenId,
                        feeTier: position.fee,
                        inRange: position.inRange,
                        token0: position.token0Info,
                        token1: position.token1Info,
                    }}
                    to={{
                        kind: 'token',
                        token: incentive.rewardTokenInfo,
                        amount: formattedRewards,
                    }}
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
                                Will be claimed automatically when you unstake
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
                title="Unstake & claim"
                steps={txSteps}
                chainId={chainId}
                onDone={onClose}
            />
        </>
    )
}
