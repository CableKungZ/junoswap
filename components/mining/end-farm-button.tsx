'use client'

import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import { Button } from '@/components/ui/button'
import { useEndIncentive } from '@/hooks/useEndIncentive'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import { getEndIncentiveBlocker } from '@/services/mining/incentives'
import { formatRelativeTimeShort } from '@/lib/duration'
import { getChainMetadata } from '@/lib/wagmi'
import { toastError, toastSuccess } from '@/lib/toast'
import { TxFlowDialog, actionStep } from '@/components/ui/tx-flow-dialog'
import { TxStageRecord } from '@/components/ui/tx-stage'
import { cn } from '@/lib/utils'
import type { Incentive } from '@/types/earn'

interface EndFarmButtonProps {
    incentive: Incentive
    onSettled: () => void
    size?: 'sm' | 'default'
    className?: string
}

/**
 * One instance owns one simulate, so this lives at the row/card level rather than in a list that
 * would fan out a write simulation per farm on every render.
 */
export function EndFarmButton({
    incentive,
    onSettled,
    size = 'default',
    className,
}: EndFarmButtonProps) {
    const chainId = useChainId()
    const now = useNowSeconds()
    const [processedTxHash, setProcessedTxHash] = useState<`0x${string}` | null>(null)
    const [txOpen, setTxOpen] = useState(false)

    const { endIncentive, isPreparing, isExecuting, isConfirming, isSuccess, error, hash } =
        useEndIncentive(incentive)

    useEffect(() => {
        if (!isSuccess || !hash || hash === processedTxHash) return
        setProcessedTxHash(hash)
        const explorer = getChainMetadata(chainId).explorer
        toastSuccess('Rewards refunded to your wallet', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${explorer}/tx/${hash}`, '_blank'),
            },
        })
        onSettled()
    }, [isSuccess, hash, processedTxHash, chainId, onSettled])

    useEffect(() => {
        if (error) toastError(error)
    }, [error])

    const blocker = getEndIncentiveBlocker(incentive)
    const isBusy = isPreparing || isExecuting || isConfirming

    const handleEnd = () => {
        setTxOpen(true)
        endIncentive()
    }
    const txSteps = [
        actionStep({
            label: 'End farm & refund',
            flags: {
                isPending: isPreparing || isExecuting,
                isConfirming,
                isSuccess,
                isError: !!error,
                error,
                hash,
            },
            run: endIncentive,
            renderStage: (phase) => (
                <TxStageRecord
                    phase={phase}
                    chainId={chainId}
                    hash={hash}
                    rows={[
                        ['Farm', `${incentive.poolToken0.symbol} / ${incentive.poolToken1.symbol}`],
                        ['Reward token', incentive.rewardTokenInfo.symbol],
                        ['Refund to', 'Farm creator'],
                    ]}
                />
            ),
        }),
    ]

    const label = (() => {
        if (isExecuting) return 'Confirm in wallet...'
        if (isConfirming) return 'Refunding...'
        switch (blocker) {
            case 'NOT_ENDED':
                return `Ends ${formatRelativeTimeShort(incentive.endTime, now)}`
            case 'STAKES_REMAINING':
                return `Waiting on ${incentive.numberOfStakes} position${
                    incentive.numberOfStakes === 1 ? '' : 's'
                }`
            case 'NOTHING_TO_REFUND':
                return 'Fully distributed'
            default:
                return 'End & Refund'
        }
    })()

    return (
        <>
            <Button
                size={size}
                variant={blocker === null ? 'default' : 'outline'}
                disabled={blocker !== null || isBusy}
                isLoading={isBusy}
                loadingText={label}
                onClick={handleEnd}
                className={cn(className)}
            >
                {label}
            </Button>

            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="End farm & refund"
                steps={txSteps}
                chainId={chainId}
            />
        </>
    )
}
