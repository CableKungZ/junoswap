'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { PaginationControls } from '@/components/ui/pagination'
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
import { clampPage, getTotalPages, paginate } from '@/services/mining/farm-list'
import {
    filterStakingPools,
    getStakingApr,
    getStakingStatus,
    rewardPerSecond,
    sortStakingPools,
} from '@/services/staking/metrics'
import { formatDuration, formatRelativeTime } from '@/lib/duration'
import {
    formatAprPercent,
    formatExactAmount,
    formatRateAmount,
    formatRewardAmount,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatBalance, formatTokenAmount, parseTokenAmount } from '@/lib/tokens'
import { toastError, toastSuccess } from '@/lib/toast'
import type { StakingPool, StakingPoolFilter, StakingPoolStatus } from '@/types/staking'

const SECONDS_PER_DAY = 86_400
const LOTS_PER_PAGE = 4

function min(a: bigint, b: bigint): bigint {
    return a < b ? a : b
}

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
    unit,
    value,
    sub,
    subHint,
    hint,
    accent,
}: {
    label: string
    unit?: string
    value: string
    sub?: string
    /** The exact figure behind an abbreviated `sub`, on hover. */
    subHint?: string
    hint?: string
    accent?: boolean
}) {
    return (
        <div className="min-w-0">
            <div
                className={cn(
                    'truncate text-[10px] uppercase tracking-wider text-muted-foreground',
                    hint && 'cursor-help underline decoration-dotted underline-offset-2'
                )}
                title={hint}
            >
                {label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
                <span
                    className={cn(
                        'truncate text-base font-bold tracking-tight',
                        accent && 'text-positive'
                    )}
                >
                    {value}
                </span>
                {unit && (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                        {unit}
                    </span>
                )}
            </div>
            {sub && (
                <div
                    className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
                    title={subHint}
                >
                    {sub}
                </div>
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
    // Every creator action is only legal between epochs, so the gear stays hidden until then.
    const canManagePool = status === 'ended' || status === 'closed'
    const claim = useStakingPoolActions(pool.address, pool.view.stakingToken)
    const queryClient = useQueryClient()
    useOnTxSuccess(true, claim.isSuccess, claim.hash, () => {
        toastSuccess('Rewards claimed')
        queryClient.invalidateQueries()
    })
    useEffect(() => {
        if (claim.error) toastError(claim.error)
    }, [claim.error])
    const perDay = rewardPerSecond(pool.view, pool.rewardTokenInfo.decimals) * SECONDS_PER_DAY
    // A cap is a limit a staker can actually hit, so the card says how close it is.
    const capPercent =
        pool.view.maxStakingPower > 0n
            ? Number((pool.view.totalSupply * 10_000n) / pool.view.maxStakingPower) / 100
            : null
    // Share of the pool is what actually sets this account's cut of the daily reward.
    const sharePercent =
        pool.user.balance > 0n && pool.view.totalSupply > 0n
            ? Number((pool.user.balance * 10_000n) / pool.view.totalSupply) / 100
            : null
    const endsIn =
        status === 'active'
            ? `Ends ${formatRelativeTime(Number(pool.view.periodFinish), now)}`
            : status === 'pending'
              ? `Starts ${formatRelativeTime(Number(pool.view.startTime), now)}`
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
                            <div className="truncate text-xs text-muted-foreground">{endsIn}</div>
                        </div>
                    </div>
                    <StatusBadge status={status} />
                </div>

                <Separator className="my-4" />

                <div className="flex flex-1 flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Metric
                            label="APR"
                            value={formatAprPercent(aprPercent)}
                            sub={pool.view.totalSupply === 0n ? 'no stakers yet' : undefined}
                        />
                        <Metric
                            label="Total staked"
                            unit={pool.stakingTokenInfo.symbol}
                            value={formatBalance(
                                pool.view.totalSupply,
                                pool.stakingTokenInfo.decimals
                            )}
                            sub={
                                capPercent === null
                                    ? undefined
                                    : `${capPercent.toFixed(capPercent >= 10 ? 0 : 1)}% of ${formatBalance(
                                          pool.view.maxStakingPower,
                                          pool.stakingTokenInfo.decimals
                                      )} cap`
                            }
                            subHint={
                                capPercent === null
                                    ? undefined
                                    : `${formatExactAmount(pool.view.totalSupply, pool.stakingTokenInfo.decimals)} of ${formatExactAmount(
                                          pool.view.maxStakingPower,
                                          pool.stakingTokenInfo.decimals
                                      )} ${pool.stakingTokenInfo.symbol} staked`
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Metric
                            label="Daily Reward"
                            unit={pool.rewardTokenInfo.symbol}
                            value={perDay > 0 ? formatRateAmount(perDay) : '—'}
                            hint="The epoch's whole budget spread evenly over its duration, then split between everyone staked at that moment — so your share moves with the total staked, not with the clock."
                        />
                        <Metric
                            label="Your staked power"
                            unit={pool.stakingTokenInfo.symbol}
                            value={formatBalance(pool.user.balance, pool.stakingTokenInfo.decimals)}
                            sub={
                                sharePercent === null
                                    ? 'nothing staked yet'
                                    : `${sharePercent.toFixed(2)}% of the pool`
                            }
                            accent={pool.user.balance > 0n}
                        />
                    </div>

                    {pool.user.earned > 0n && (
                        <div className="mt-auto rounded-xl bg-muted/30 px-3 py-2 text-xs">
                            <div className="flex items-baseline justify-between">
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
                    {isConnected && pool.user.earned > 0n && (
                        <Button
                            className="flex-1"
                            variant="outline"
                            disabled={claim.isPending || claim.isConfirming}
                            isLoading={claim.isPending || claim.isConfirming}
                            onClick={() => claim.claim()}
                        >
                            Claim
                        </Button>
                    )}
                    <Button
                        className="flex-1"
                        variant={status === 'active' ? 'default' : 'outline'}
                        onClick={() => (isConnected ? onManage(pool) : onConnect())}
                    >
                        {isConnected ? 'Manage' : 'Connect Wallet'}
                    </Button>
                    {isCreator && canManagePool && (
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
    const [lotPage, setLotPage] = useState(1)
    const lotPages = getTotalPages(lots.length, LOTS_PER_PAGE)
    const safeLotPage = clampPage(lotPage, lotPages)
    const pagedLots = paginate(lots, safeLotPage, LOTS_PER_PAGE)

    useEffect(() => {
        if (!open) return
        setMode('stake')
        setAmount('')
        setLotPage(1)
        queuedStake.current = null
    }, [open, pool?.address])

    // One click: the approval carries the stake it was for, so the wallet asks twice but the
    // user never has to come back and press the button again.
    const queuedStake = useRef<bigint | null>(null)

    useOnTxSuccess(open, actions.isSuccess, actions.hash, () => {
        const queued = queuedStake.current
        queuedStake.current = null
        if (queued !== null) {
            actions.stake(queued)
            return
        }
        setAmount('')
        toastSuccess('Transaction confirmed')
        onSuccess()
    })

    useEffect(() => {
        if (actions.error) toastError(actions.error)
    }, [actions.error])

    if (!pool) return null

    const decimals = pool.stakingTokenInfo.decimals
    // Nothing staked means there is nothing to withdraw, so that side is not offered.
    const canWithdraw = pool.user.balance > 0n
    const activeMode = canWithdraw ? mode : 'stake'
    // A capped pool refuses anything past its remaining power, so the cap bounds the input the
    // same way the wallet balance does — the amount can never be one the chain would reject.
    const capped = pool.view.maxStakingPower > 0n
    const room = capped
        ? min(pool.user.stakingBalance, pool.view.remainingStakingPower)
        : pool.user.stakingBalance
    const max = activeMode === 'stake' ? room : pool.user.withdrawable
    const parsed = amount ? parseTokenAmount(amount, decimals) : 0n
    const needsApproval =
        activeMode === 'stake' && parsed > 0n && pool.user.stakingAllowance < parsed
    const isBusy = actions.isPending || actions.isConfirming
    const locked = pool.user.balance - pool.user.withdrawable

    const label = () => {
        if (parsed <= 0n) return 'Enter an amount'
        if (parsed > max) {
            if (activeMode === 'withdraw') return 'Still locked'
            return capped && pool.view.remainingStakingPower < pool.user.stakingBalance
                ? 'Over the pool cap'
                : 'Insufficient balance'
        }
        if (needsApproval) return `Approve & Stake`
        return activeMode === 'stake' ? 'Stake' : 'Withdraw'
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
                    {canWithdraw && (
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/30 p-1">
                            {(['stake', 'withdraw'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        setMode(m)
                                        setAmount('')
                                        setLotPage(1)
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
                    )}

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
                                {activeMode === 'stake'
                                    ? capped &&
                                      pool.view.remainingStakingPower < pool.user.stakingBalance
                                        ? 'Cap room'
                                        : 'Balance'
                                    : 'Unlocked'}
                                : {formatBalance(max, decimals)}
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

                    {activeMode === 'withdraw' && pool.user.withdrawable > 0n && (
                        <Button
                            variant="outline"
                            className="w-full"
                            disabled={isBusy}
                            onClick={() => actions.exit()}
                        >
                            Withdraw all
                            {pool.user.earned > 0n ? ' & claim' : ''} (
                            {formatBalance(pool.user.withdrawable, decimals)}{' '}
                            {pool.stakingTokenInfo.symbol})
                        </Button>
                    )}

                    {activeMode === 'withdraw' && locked > 0n && (
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
                        onClick={() => {
                            if (needsApproval) {
                                queuedStake.current = parsed
                                actions.approve()
                                return
                            }
                            if (activeMode === 'stake') actions.stake(parsed)
                            else actions.withdraw(parsed)
                        }}
                    >
                        {label()}
                    </Button>

                    {activeMode === 'withdraw' && lots.length > 0 && (
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
                            <div className="space-y-1">
                                {pagedLots.map((lot) => {
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
                            {lotPages > 1 && (
                                <PaginationControls
                                    currentPage={safeLotPage}
                                    totalPages={lotPages}
                                    onPageChange={setLotPage}
                                />
                            )}
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
