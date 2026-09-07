'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { Check } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { useIncentives } from '@/hooks/useIncentives'
import { useStakerDeposits } from '@/hooks/useStakerDeposits'
import { useFarmStakes, toStakedPosition } from '@/hooks/useFarmStakes'
import { usePendingRewardsMultiple } from '@/hooks/useRewards'
import { useUnstakePositions } from '@/hooks/useStaking'
import { formatRewardAmount } from '@/lib/format'
import { formatBalance, getDisplayToken } from '@/lib/tokens'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { markUnstaked } from '@/lib/optimistic-deposits'
import { toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { Incentive } from '@/types/earn'

interface FarmUnstakeDialogProps {
    open: boolean
    incentive: Incentive | null
    onClose: () => void
    onSuccess?: () => void
}

function CheckBox({ checked }: { checked: boolean }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
            )}
        >
            {checked && <Check className="h-3 w-3" />}
        </span>
    )
}

/**
 * Unstaking from the farm side. A wallet can hold several positions in one farm, so every position
 * is selected by default and the whole selection leaves in a single transaction — otherwise getting
 * three positions out would mean three signatures.
 */
export function FarmUnstakeDialog({ open, incentive, onClose, onSuccess }: FarmUnstakeDialogProps) {
    const { address } = useAccount()
    const chainId = useChainId()
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [hasTouchedSelection, setHasTouchedSelection] = useState(false)

    const { incentives } = useIncentives()
    const { deposits } = useStakerDeposits()
    const { stakes, isLoading } = useFarmStakes(incentives, deposits)

    const myStakes = useMemo(() => {
        if (!incentive || !address) return []
        const owner = address.toLowerCase()
        return stakes.filter(
            (stake) =>
                stake.incentive.incentiveId === incentive.incentiveId &&
                stake.depositor.toLowerCase() === owner
        )
    }, [stakes, incentive, address])

    const stakedPositions = useMemo(() => myStakes.map(toStakedPosition), [myStakes])
    const { rewards } = usePendingRewardsMultiple(stakedPositions)

    useEffect(() => {
        if (!open) return
        setSelectedIds([])
        setHasTouchedSelection(false)
    }, [open])

    // Everything is selected until the user narrows it down, so the common case is one click.
    useEffect(() => {
        if (hasTouchedSelection || myStakes.length === 0) return
        setSelectedIds(myStakes.map((stake) => stake.position.tokenId.toString()))
    }, [myStakes, hasTouchedSelection])

    const selectedTokenIds = useMemo(() => {
        const wanted = new Set(selectedIds)
        return myStakes
            .filter((stake) => wanted.has(stake.position.tokenId.toString()))
            .map((stake) => stake.position.tokenId)
    }, [myStakes, selectedIds])

    const { unstake, isPreparing, isExecuting, isConfirming, isSuccess, error, hash } =
        useUnstakePositions(selectedTokenIds, incentive, address, incentive?.program ?? 'v3')

    useOnTxSuccess(open, isSuccess, hash, () => {
        if (address) {
            for (const tokenId of selectedTokenIds) markUnstaked(chainId, address, tokenId)
        }
        const count = selectedTokenIds.length
        toastSuccess(
            count === 1
                ? 'Position unstaked and rewards claimed'
                : `${count} positions unstaked and rewards claimed`
        )
        onSuccess?.()
        onClose()
    })

    useEffect(() => {
        if (error) toastError(error)
    }, [error])

    if (!incentive) return null

    const toggle = (tokenId: string) => {
        setHasTouchedSelection(true)
        setSelectedIds((prev) =>
            prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId]
        )
    }

    const allSelected = myStakes.length > 0 && selectedTokenIds.length === myStakes.length
    const rewardToken = getDisplayToken(incentive.rewardTokenInfo)
    const isBusy = isPreparing || isExecuting || isConfirming
    const buttonLabel =
        selectedTokenIds.length === 0
            ? 'Select a position'
            : isExecuting
              ? 'Confirm in wallet...'
              : isConfirming
                ? 'Unstaking...'
                : selectedTokenIds.length === 1
                  ? 'Unstake & Claim'
                  : `Unstake ${selectedTokenIds.length} & Claim`

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Unstake from Farm</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="rounded-lg bg-muted p-4">
                        <div className="font-medium">
                            {getDisplayToken(incentive.poolToken0).symbol} /{' '}
                            {getDisplayToken(incentive.poolToken1).symbol}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Selected positions leave in one transaction, rewards included.
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Your staked positions</Label>
                            {myStakes.length > 1 && (
                                <button
                                    type="button"
                                    className="text-xs font-medium text-primary hover:opacity-80"
                                    onClick={() => {
                                        setHasTouchedSelection(true)
                                        setSelectedIds(
                                            allSelected
                                                ? []
                                                : myStakes.map((stake) =>
                                                      stake.position.tokenId.toString()
                                                  )
                                        )
                                    }}
                                >
                                    {allSelected ? 'Clear' : 'Select all'}
                                </button>
                            )}
                        </div>

                        {isLoading ? (
                            <EmptyState title="Loading positions..." />
                        ) : myStakes.length === 0 ? (
                            <EmptyState
                                title="Nothing staked here"
                                description="You have no positions staked in this farm."
                                className="rounded-lg border p-4"
                            />
                        ) : (
                            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                {myStakes.map((stake) => {
                                    const tokenId = stake.position.tokenId.toString()
                                    const isSelected = selectedIds.includes(tokenId)
                                    const reward =
                                        rewards.get(`${tokenId}-${incentive.incentiveId}`) ?? 0n
                                    return (
                                        <button
                                            key={tokenId}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => toggle(tokenId)}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                                                isSelected
                                                    ? 'border-primary bg-primary/5'
                                                    : 'hover:border-primary/50'
                                            )}
                                        >
                                            <CheckBox checked={isSelected} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        Position #{tokenId}
                                                    </span>
                                                    {stake.position.inRange ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-positive/20 bg-positive/10 text-positive"
                                                        >
                                                            In Range
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-muted-foreground"
                                                        >
                                                            Out of Range
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="truncate text-sm text-muted-foreground">
                                                    {formatBalance(
                                                        stake.position.amount0,
                                                        stake.position.token0Info.decimals
                                                    )}{' '}
                                                    {
                                                        getDisplayToken(stake.position.token0Info)
                                                            .symbol
                                                    }{' '}
                                                    +{' '}
                                                    {formatBalance(
                                                        stake.position.amount1,
                                                        stake.position.token1Info.decimals
                                                    )}{' '}
                                                    {
                                                        getDisplayToken(stake.position.token1Info)
                                                            .symbol
                                                    }
                                                </div>
                                                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                                                    {formatRewardAmount(
                                                        reward,
                                                        incentive.rewardTokenInfo.decimals
                                                    )}{' '}
                                                    {rewardToken.symbol} unclaimed
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        size="lg"
                        onClick={unstake}
                        disabled={selectedTokenIds.length === 0 || isBusy}
                        isLoading={isBusy}
                        loadingText={buttonLabel}
                    >
                        {buttonLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
