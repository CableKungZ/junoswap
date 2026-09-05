'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { zeroAddress } from 'viem'
import { ERC20_ABI } from '@coshi190/juno-moneta-sdk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useStakingPoolActions, useStartEpoch } from '@/hooks/useStakingActions'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { DurationField, unitSeconds, type ScheduleUnit } from '@/components/earn/duration-field'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import { getStakingStatus } from '@/services/staking/metrics'
import { formatBalance, parseTokenAmount } from '@/lib/tokens'
import { formatDuration } from '@/lib/duration'
import { toastError, toastSuccess } from '@/lib/toast'
import type { StakingPool } from '@/types/staking'

const SECONDS_PER_DAY = 86_400
const MAX_DURATION_DAYS = 365

/**
 * What the pool's creator can do that a staker cannot: fund the next epoch on the same pool,
 * retire it, and pull back the budget that ran while nothing was staked. All three are only
 * legal between epochs, so the panel follows the schedule rather than offering dead buttons.
 */
export function StakingCreatorPanel({
    pool,
    onSettled,
}: {
    pool: StakingPool
    onSettled: () => void
}) {
    const chainId = useChainId()
    const now = useNowSeconds()
    const { address: account } = useAccount()
    const queryClient = useQueryClient()

    const [rewardAmount, setRewardAmount] = useState('')
    const [durationValue, setDurationValue] = useState('30')
    const [durationUnit, setDurationUnit] = useState<ScheduleUnit>('days')
    const [lockValue, setLockValue] = useState('0')
    const [lockUnit, setLockUnit] = useState<ScheduleUnit>('days')
    const lastAction = useRef<'approve' | 'epoch' | null>(null)

    const epoch = useStartEpoch()
    const actions = useStakingPoolActions(pool.address, pool.view.stakingToken)

    const status = getStakingStatus(pool.view, now)
    const isBetweenEpochs = status === 'ended'
    const isClosed = pool.view.closed

    const { data: allowance } = useReadContract({
        address: pool.view.rewardsToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account ?? zeroAddress, epoch.factory ?? zeroAddress],
        chainId,
        query: { enabled: !!account && !!epoch.factory },
    })

    const rewardWei = parseTokenAmount(rewardAmount || '0', pool.rewardTokenInfo.decimals)
    const duration = Number(durationValue || '0') * unitSeconds(durationUnit)
    const lock = Number(lockValue || '0') * unitSeconds(lockUnit)
    const needsApproval = rewardWei > 0n && ((allowance as bigint | undefined) ?? 0n) < rewardWei
    const isBusy = epoch.isPending || epoch.isConfirming

    const submitEpoch = () => {
        lastAction.current = 'epoch'
        epoch.startEpoch(pool.address, {
            rewardAmount: rewardWei,
            startTime: 0n,
            rewardsDuration: BigInt(duration),
            lockDuration: BigInt(lock),
            maxStakingPower: 0n,
        })
    }

    useOnTxSuccess(true, epoch.isSuccess, epoch.hash, () => {
        if (lastAction.current === 'approve') {
            submitEpoch()
            return
        }
        toastSuccess('Next epoch funded')
        queryClient.invalidateQueries()
        setRewardAmount('')
        onSettled()
    })

    useOnTxSuccess(true, actions.isSuccess, actions.hash, () => {
        toastSuccess('Pool updated')
        queryClient.invalidateQueries()
        onSettled()
    })

    useEffect(() => {
        if (epoch.error) toastError(epoch.error)
    }, [epoch.error])
    useEffect(() => {
        if (actions.error) toastError(actions.error)
    }, [actions.error])

    const epochBlocker = (() => {
        if (isClosed) return 'Pool is retired'
        if (!isBetweenEpochs) return 'Current epoch is still running'
        if (rewardWei <= 0n) return 'Enter the reward amount'
        if (duration <= 0) return 'Enter the duration'
        if (duration > MAX_DURATION_DAYS * SECONDS_PER_DAY) return 'At most 365 days'
        if (lock > duration) return 'Lock cannot outlast the epoch'
        return null
    })()

    return (
        <div className="space-y-4">
            <Separator />
            <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold">Creator controls</h4>
                <span className="text-[11px] text-muted-foreground">
                    epoch {pool.epoch} · {isClosed ? 'retired' : status}
                </span>
            </div>

            {!isClosed && (
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                            Next epoch reward ({pool.rewardTokenInfo.symbol})
                        </Label>
                        <Input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            placeholder="0.0"
                            value={rewardAmount}
                            onChange={(e) => setRewardAmount(e.target.value)}
                            disabled={!isBetweenEpochs}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <DurationField
                            label="Duration"
                            value={durationValue}
                            unit={durationUnit}
                            onValueChange={setDurationValue}
                            onUnitChange={setDurationUnit}
                            disabled={!isBetweenEpochs}
                            min="1"
                        />
                        <DurationField
                            label="Lock"
                            value={lockValue}
                            unit={lockUnit}
                            onValueChange={setLockValue}
                            onUnitChange={setLockUnit}
                            disabled={!isBetweenEpochs}
                        />
                    </div>
                    {duration > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                            Runs for {formatDuration(duration)}
                            {lock > 0 ? `, stakes locked ${formatDuration(lock)}` : ', no lock'}.
                            Existing stakes stay in place.
                        </p>
                    )}
                    <Button
                        className="w-full"
                        variant="outline"
                        disabled={isBusy || epochBlocker !== null}
                        isLoading={isBusy}
                        loadingText={
                            lastAction.current === 'approve' ? 'Approving...' : 'Funding epoch...'
                        }
                        onClick={() => {
                            if (epochBlocker) return
                            if (needsApproval) {
                                lastAction.current = 'approve'
                                epoch.approveReward(pool.view.rewardsToken)
                                return
                            }
                            submitEpoch()
                        }}
                    >
                        {epochBlocker ?? 'Fund next epoch'}
                    </Button>
                </div>
            )}

            <div className="flex gap-2">
                {!isClosed && (
                    <Button
                        variant="outline"
                        className="flex-1"
                        disabled={!isBetweenEpochs || actions.isPending || actions.isConfirming}
                        onClick={() => actions.close()}
                        title="Retire the pool for good. Withdrawing and claiming stay open forever."
                    >
                        Retire pool
                    </Button>
                )}
                {isClosed && pool.view.unallocatedRewards > 0n && (
                    <Button
                        variant="outline"
                        className="flex-1"
                        disabled={actions.isPending || actions.isConfirming}
                        onClick={() => actions.recoverUnallocated()}
                    >
                        Recover{' '}
                        {formatBalance(pool.view.unallocatedRewards, pool.rewardTokenInfo.decimals)}{' '}
                        {pool.rewardTokenInfo.symbol}
                    </Button>
                )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Retiring blocks further epochs and unlocks recovery of the budget that ran while
                nothing was staked. It can never cut an epoch short, and never blocks a withdrawal.
            </p>
        </div>
    )
}
