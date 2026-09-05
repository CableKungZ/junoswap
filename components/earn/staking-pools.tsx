'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { TokenIcon } from '@/components/ui/token-icon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConnectModal } from '@/components/web3/connect-modal'
import { useStakingPools } from '@/hooks/useStakingPools'
import { useStakingPoolActions, useClaimAllStaking } from '@/hooks/useStakingActions'
import { useStakingLots } from '@/hooks/useStakingLots'
import { StakingCreatorPanel } from '@/components/earn/staking-creator-panel'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import { useTokenPriceMap } from '@/hooks/useTokenPriceMap'
import { getStakingRewards } from '@/lib/earn-programs'
import {
    filterStakingPools,
    getStakingApr,
    getStakingProgress,
    getStakingStatus,
    rewardPerSecond,
    sortStakingPools,
} from '@/services/staking/metrics'
import { formatDuration, formatRelativeTime } from '@/lib/duration'
import { formatRateAmount, formatRewardAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatBalance, formatTokenAmount, parseTokenAmount } from '@/lib/tokens'
import { toastError, toastSuccess } from '@/lib/toast'
import type { StakingPool, StakingPoolFilter, StakingPoolStatus } from '@/types/staking'

const SECONDS_PER_DAY = 86_400

const FILTERS: { value: StakingPoolFilter; label: string }[] = [
    { value: 'all', label: 'All pools' },
    { value: 'active', label: 'Active' },
    { value: 'my-stakes', label: 'My stakes' },
]

const STATUS_LABEL: Record<StakingPoolStatus, string> = {
    active: 'Active',
    pending: 'Upcoming',
    ended: 'Ended',
    closed: 'Closed',
}

function StatusBadge({ status }: { status: StakingPoolStatus }) {
    return (
        <Badge
            variant={status === 'active' ? 'default' : 'outline'}
            className="shrink-0 capitalize"
        >
            {STATUS_LABEL[status]}
        </Badge>
    )
}

function Metric({
    label,
    value,
    sub,
    hint,
}: {
    label: string
    value: string
    sub?: string
    hint?: string
}) {
    return (
        <div className="min-w-0">
            <div
                className={cn(
                    'text-[10px] uppercase tracking-wider text-muted-foreground',
                    hint && 'cursor-help underline decoration-dotted underline-offset-2'
                )}
                title={hint}
            >
                {label}
            </div>
            <div className="mt-1 truncate text-base font-bold tracking-tight">{value}</div>
            {sub && (
                <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{sub}</div>
            )}
        </div>
    )
}

function PoolCard({
    pool,
    aprPercent,
    now,
    onManage,
    onCreatorControls,
    onConnect,
}: {
    pool: StakingPool
    aprPercent: number | null
    now: number
    onManage: (pool: StakingPool) => void
    onCreatorControls: (pool: StakingPool) => void
    onConnect: () => void
}) {
    const { address: account, isConnected } = useAccount()
    const isCreator = !!account && account.toLowerCase() === pool.view.creator.toLowerCase()
    const status = getStakingStatus(pool.view, now)
    const progress = getStakingProgress(pool.view, now)
    const perDay = rewardPerSecond(pool.view, pool.rewardTokenInfo.decimals) * SECONDS_PER_DAY
    const endsIn =
        status === 'active'
            ? formatRelativeTime(Number(pool.view.periodFinish), now)
            : status === 'pending'
              ? `starts ${formatRelativeTime(Number(pool.view.startTime), now)}`
              : STATUS_LABEL[status]

    return (
        <Card className="position-card-hover flex flex-col overflow-hidden">
            <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <TokenIcon
                            src={pool.stakingTokenInfo.logo}
                            symbol={pool.stakingTokenInfo.symbol}
                            size="md"
                        />
                        <div className="min-w-0">
                            <div className="truncate font-semibold">
                                Stake {pool.stakingTokenInfo.symbol}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                Earn {pool.rewardTokenInfo.symbol} ·{' '}
                                {pool.view.lockDuration > 0n
                                    ? `${formatDuration(Number(pool.view.lockDuration))} lock`
                                    : 'no lock'}
                            </div>
                        </div>
                    </div>
                    <StatusBadge status={status} />
                </div>

                <Separator className="my-4" />

                <div className="flex flex-1 flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Metric
                            label="APR"
                            value={aprPercent === null ? '—' : `${aprPercent.toFixed(2)}%`}
                            sub={pool.view.totalSupply === 0n ? 'no stakers yet' : undefined}
                        />
                        <Metric
                            label="Total staked"
                            value={`${formatBalance(pool.view.totalSupply, pool.stakingTokenInfo.decimals)} ${pool.stakingTokenInfo.symbol}`}
                            sub={
                                pool.view.maxStakingPower > 0n
                                    ? `cap ${formatBalance(pool.view.maxStakingPower, pool.stakingTokenInfo.decimals)}`
                                    : undefined
                            }
                        />
                    </div>
                    <Metric
                        label="Emission"
                        value={
                            perDay > 0
                                ? `${formatRateAmount(perDay, pool.rewardTokenInfo.symbol)} / day`
                                : '—'
                        }
                        sub={`epoch ${pool.epoch} · ${formatRewardAmount(
                            pool.view.rewardForDuration,
                            pool.rewardTokenInfo.decimals
                        )} ${pool.rewardTokenInfo.symbol} budget`}
                        hint="The epoch's whole budget spread evenly over its duration, then split between everyone staked at that moment — so your share moves with the total staked, not with the clock."
                    />

                    <div className="mt-auto">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{endsIn}</span>
                            <span className="shrink-0 tabular-nums">{progress}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary/70 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {(pool.user.balance > 0n || pool.user.earned > 0n) && (
                        <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
                            <div className="flex items-baseline justify-between">
                                <span className="text-muted-foreground">Your stake</span>
                                <span className="font-medium tabular-nums">
                                    {formatBalance(
                                        pool.user.balance,
                                        pool.stakingTokenInfo.decimals
                                    )}{' '}
                                    {pool.stakingTokenInfo.symbol}
                                </span>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-muted-foreground">Earned</span>
                                <span className="font-medium tabular-nums text-positive">
                                    {formatRewardAmount(
                                        pool.user.earned,
                                        pool.rewardTokenInfo.decimals
                                    )}{' '}
                                    {pool.rewardTokenInfo.symbol}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex gap-2">
                    <Button
                        className="flex-1"
                        variant={status === 'active' ? 'default' : 'outline'}
                        onClick={() => (isConnected ? onManage(pool) : onConnect())}
                    >
                        {!isConnected ? 'Connect Wallet' : status === 'active' ? 'Stake' : 'Manage'}
                    </Button>
                    {isCreator && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            title="Creator controls"
                            aria-label="Creator controls"
                            onClick={() => onCreatorControls(pool)}
                        >
                            <Settings2 />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

/** Stake, withdraw and claim for one pool. Balances and allowance come from the lens read. */
function ManagePoolDialog({
    pool,
    open,
    onClose,
    onSuccess,
}: {
    pool: StakingPool | null
    open: boolean
    onClose: () => void
    onSuccess: () => void
}) {
    const now = useNowSeconds()
    const [mode, setMode] = useState<'stake' | 'withdraw'>('stake')
    const [amount, setAmount] = useState('')
    const actions = useStakingPoolActions(pool?.address, pool?.view.stakingToken)
    const { lots } = useStakingLots(pool?.address, open)

    useEffect(() => {
        if (!open) return
        setMode('stake')
        setAmount('')
    }, [open, pool?.address])

    useOnTxSuccess(open, actions.isSuccess, actions.hash, () => {
        setAmount('')
        toastSuccess('Transaction confirmed')
        onSuccess()
    })

    useEffect(() => {
        if (actions.error) toastError(actions.error)
    }, [actions.error])

    if (!pool) return null

    const decimals = pool.stakingTokenInfo.decimals
    const max = mode === 'stake' ? pool.user.stakingBalance : pool.user.withdrawable
    const parsed = amount ? parseTokenAmount(amount, decimals) : 0n
    const needsApproval = mode === 'stake' && parsed > 0n && pool.user.stakingAllowance < parsed
    const isBusy = actions.isPending || actions.isConfirming
    const locked = pool.user.balance - pool.user.withdrawable

    const label = () => {
        if (parsed <= 0n) return 'Enter an amount'
        if (parsed > max) return mode === 'stake' ? 'Insufficient balance' : 'Still locked'
        if (needsApproval) return `Approve ${pool.stakingTokenInfo.symbol}`
        return mode === 'stake' ? 'Stake' : 'Withdraw'
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-lg">
                        {pool.stakingTokenInfo.symbol} pool
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/30 p-1">
                        {(['stake', 'withdraw'] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => {
                                    setMode(m)
                                    setAmount('')
                                }}
                                className={`rounded-lg py-1.5 text-sm font-medium capitalize transition-colors ${
                                    mode === m
                                        ? 'bg-background text-foreground'
                                        : 'text-muted-foreground'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                Amount
                            </Label>
                            <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setAmount(formatTokenAmount(max, decimals))}
                            >
                                {mode === 'stake' ? 'Balance' : 'Unlocked'}:{' '}
                                {formatBalance(max, decimals)}
                            </button>
                        </div>
                        <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    {mode === 'withdraw' && locked > 0n && (
                        <p className="rounded-xl bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                            {formatBalance(locked, decimals)} {pool.stakingTokenInfo.symbol} is
                            still locked
                            {pool.user.nextUnlockAt > 0n
                                ? `, unlocking ${formatRelativeTime(Number(pool.user.nextUnlockAt), now)}`
                                : ''}
                            . Claiming rewards is never locked.
                        </p>
                    )}

                    <Button
                        className="w-full"
                        size="lg"
                        disabled={isBusy || parsed <= 0n || parsed > max}
                        isLoading={isBusy}
                        loadingText={label()}
                        onClick={() => {
                            if (needsApproval) {
                                actions.approve()
                                return
                            }
                            if (mode === 'stake') actions.stake(parsed)
                            else actions.withdraw(parsed)
                        }}
                    >
                        {label()}
                    </Button>

                    {pool.user.earned > 0n && (
                        <Button
                            variant="outline"
                            className="w-full"
                            disabled={isBusy}
                            onClick={() => actions.claim()}
                        >
                            Claim{' '}
                            {formatRewardAmount(pool.user.earned, pool.rewardTokenInfo.decimals)}{' '}
                            {pool.rewardTokenInfo.symbol}
                        </Button>
                    )}

                    {lots.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Your deposits
                                </Label>
                                <span
                                    className="text-[11px] text-muted-foreground"
                                    title="Every stake is its own lot with its own unlock time, so a later deposit never re-locks an earlier one."
                                >
                                    {lots.length} lot{lots.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                                {lots.map((lot) => {
                                    const unlocked = lot.unlockAt <= now
                                    return (
                                        <div
                                            key={lot.index}
                                            className="flex items-center justify-between gap-2 rounded-xl bg-muted/20 px-3 py-2 text-xs"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-medium tabular-nums">
                                                    {formatBalance(lot.amount, decimals)}{' '}
                                                    {pool.stakingTokenInfo.symbol}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {unlocked
                                                        ? 'unlocked'
                                                        : `unlocks ${formatRelativeTime(lot.unlockAt, now)}`}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!unlocked || isBusy}
                                                onClick={() =>
                                                    actions.withdrawFrom(
                                                        BigInt(lot.index),
                                                        lot.amount
                                                    )
                                                }
                                            >
                                                Withdraw
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function CreatorControlsDialog({
    pool,
    open,
    onClose,
    onSettled,
}: {
    pool: StakingPool | null
    open: boolean
    onClose: () => void
    onSettled: () => void
}) {
    if (!pool) return null
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-md border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-lg">
                        {pool.stakingTokenInfo.symbol} pool · creator
                    </DialogTitle>
                </DialogHeader>
                <StakingCreatorPanel pool={pool} onSettled={onSettled} />
            </DialogContent>
        </Dialog>
    )
}

export function StakingPools({ onCreate }: { onCreate: () => void }) {
    const chainId = useChainId()
    const now = useNowSeconds()
    const queryClient = useQueryClient()
    const { pools, isLoading } = useStakingPools()
    const { priceMap } = useTokenPriceMap(chainId)
    const [filter, setFilter] = useState<StakingPoolFilter>('all')
    const [managed, setManaged] = useState<StakingPool | null>(null)
    const [creatorPool, setCreatorPool] = useState<StakingPool | null>(null)
    const [isConnectOpen, setIsConnectOpen] = useState(false)

    const visible = useMemo(
        () => sortStakingPools(filterStakingPools(pools, filter, now), now),
        [pools, filter, now]
    )

    // One transaction for every pool that owes the viewer something.
    const claimable = useMemo(() => pools.filter((p) => p.user.earned > 0n), [pools])
    const batch = useClaimAllStaking()
    useOnTxSuccess(true, batch.isSuccess, batch.hash, () => {
        toastSuccess('Rewards claimed')
        queryClient.invalidateQueries()
    })
    useEffect(() => {
        if (batch.error) toastError(batch.error)
    }, [batch.error])

    // Keep the open dialog pointed at the freshly read pool, so balances update behind it.
    const fresh = (pool: StakingPool | null) =>
        pool ? (pools.find((p) => p.address === pool.address) ?? pool) : null
    const managedPool = fresh(managed)
    const creatorControlsPool = fresh(creatorPool)

    const header = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold sm:text-xl">Staking Pools</h2>
            <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-muted/30 p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            onClick={() => setFilter(f.value)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                filter === f.value
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                {claimable.length > 1 && (
                    <Button
                        variant="outline"
                        disabled={batch.isPending || batch.isConfirming}
                        isLoading={batch.isPending || batch.isConfirming}
                        loadingText="Claiming..."
                        onClick={() => batch.claimAll(claimable.map((p) => p.address))}
                    >
                        Claim all ({claimable.length})
                    </Button>
                )}
                <Button variant="outline" onClick={onCreate}>
                    <Plus />
                    Create Program
                </Button>
            </div>
        </div>
    )

    if (!getStakingRewards(chainId)) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold sm:text-xl">Staking Pools</h2>
                <EmptyState
                    title="Not available"
                    description="Token staking is not available on this chain."
                />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {header}
            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Card key={i}>
                            <CardContent className="h-64 animate-pulse p-5" />
                        </Card>
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <EmptyState
                    title={pools.length === 0 ? 'No staking pools yet' : 'Nothing matches'}
                    description={
                        pools.length === 0
                            ? 'Open the first pool: pick a token to stake, a reward and a schedule.'
                            : 'No pool matches this filter.'
                    }
                    action={
                        pools.length === 0 ? (
                            <Button variant="outline" onClick={onCreate}>
                                <Plus />
                                Create Program
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((pool) => (
                        <PoolCard
                            key={pool.address}
                            pool={pool}
                            now={now}
                            aprPercent={getStakingApr(pool, {
                                stakingUsd: priceMap.get(pool.view.stakingToken.toLowerCase()),
                                rewardUsd: priceMap.get(pool.view.rewardsToken.toLowerCase()),
                            })}
                            onManage={setManaged}
                            onCreatorControls={setCreatorPool}
                            onConnect={() => setIsConnectOpen(true)}
                        />
                    ))}
                </div>
            )}
            <ManagePoolDialog
                pool={managedPool}
                open={managed !== null}
                onClose={() => setManaged(null)}
                onSuccess={() => queryClient.invalidateQueries()}
            />
            <CreatorControlsDialog
                pool={creatorControlsPool}
                open={creatorPool !== null}
                onClose={() => setCreatorPool(null)}
                onSettled={() => queryClient.invalidateQueries()}
            />
            <ConnectModal open={isConnectOpen} onOpenChange={setIsConnectOpen} />
        </div>
    )
}
