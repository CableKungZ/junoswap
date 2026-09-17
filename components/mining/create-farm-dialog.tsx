'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TokenIcon } from '@/components/ui/token-icon'
import { TokenSelect } from '@/components/swap/token-select'
import { ConnectModal } from '@/components/web3/connect-modal'
import { FarmPoolPicker } from './farm-pool-picker'
import { FarmScheduleInput } from './farm-schedule-input'
import { useCreateIncentive } from '@/hooks/useCreateIncentive'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { useStakerLimits } from '@/hooks/useStakerLimits'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import { useV3Tokens } from '@/hooks/useV3Tokens'
import { useBurnedPoolLiquidity } from '@/hooks/useBurnedPoolLiquidity'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
    calculateRewardRate,
    createEmptyIncentiveForm,
    describeCreateIncentiveError,
    primaryError,
    resolveStartTime,
} from '@/services/mining/create-incentive'
import { formatDateTime, formatDuration, formatRelativeTime, SECONDS_PER_DAY } from '@/lib/duration'
import { formatBalance, formatTokenAmount, getTokensForChain } from '@/lib/tokens'
import { formatRateAmount } from '@/lib/format'
import { getChainMetadata, isNativeToken } from '@/lib/wagmi'
import { toastError, toastSuccess } from '@/lib/toast'
import { TxFlowDialog, approvalStep, actionStep, type TxStep } from '@/components/ui/tx-flow-dialog'
import { TxStageRecord } from '@/components/ui/tx-stage'
import { EARN_PROGRAM_LABEL, type EarnProgram } from '@/lib/earn-programs'
import type { CreateIncentiveForm, V3PoolData } from '@/types/earn'
import type { Token } from '@/types/token'

const INDEXER_SETTLE_MS = 5000

interface CreateFarmDialogProps {
    open: boolean
    initialPool?: V3PoolData | null
    /** Which staker the farm is created on — picked in the Create Earn Program dialog. */
    program?: EarnProgram
    onClose: () => void
    onSuccess?: () => void
}

function SummaryRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium tabular-nums">{value}</span>
        </div>
    )
}

export function CreateFarmDialog({
    open,
    initialPool,
    program = 'v3',
    onClose,
    onSuccess,
}: CreateFarmDialogProps) {
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const queryClient = useQueryClient()
    const now = useNowSeconds()
    const { limits } = useStakerLimits(program)

    const [form, setForm] = useState<CreateIncentiveForm>(createEmptyIncentiveForm)
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        setForm({ ...createEmptyIncentiveForm(), pool: initialPool ?? null })
    }, [open, initialPool])

    const { tokens: v3Tokens } = useV3Tokens(chainId)
    const rewardTokenOptions = useMemo<Token[]>(() => {
        const byAddress = new Map<string, Token>()
        for (const token of getTokensForChain(chainId)) {
            if (isNativeToken(token.address as Address)) continue
            byAddress.set(token.address.toLowerCase(), token)
        }
        for (const t of v3Tokens) {
            const key = t.address.toLowerCase()
            if (byAddress.has(key)) continue
            byAddress.set(key, {
                address: t.address as Address,
                symbol: t.symbol || '???',
                name: t.name || t.symbol || '',
                decimals: t.decimals ?? 18,
                chainId,
            })
        }
        return Array.from(byAddress.values())
    }, [chainId, v3Tokens])

    const {
        errors,
        rewardAmount,
        balance,
        submit,
        stakerAddress,
        needsApproval,
        approve,
        create,
        isAwaitingApproval,
        isApproving,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        error,
        hash,
    } = useCreateIncentive(form, limits, program)
    const [txOpen, setTxOpen] = useState(false)
    // Frozen when the flow opens: needsApproval flips the moment the allowance lands,
    // and rebuilding from it would delete the step being watched.
    const [flowNeedsApproval, setFlowNeedsApproval] = useState(false)

    useOnTxSuccess(open, isSuccess, hash, (hash) => {
        const explorer = getChainMetadata(chainId).explorer
        toastSuccess('Mining farm created!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${explorer}/tx/${hash}`, '_blank'),
            },
        })
        onSuccess?.()
        // The farm only appears once the indexer has seen IncentiveCreated, so refresh once more
        // after it has had a chance to catch up.
        setTimeout(
            () => queryClient.invalidateQueries({ queryKey: ['incentives'] }),
            INDEXER_SETTLE_MS
        )
        // The tx dialog owns the success frame and closes both from its Done button.
    })

    useEffect(() => {
        if (error) toastError(error)
    }, [error])

    const patch = (next: Partial<CreateIncentiveForm>) => setForm((prev) => ({ ...prev, ...next }))
    const rewardToken = form.rewardToken

    const startTime = resolveStartTime(form, now)
    const endTime =
        startTime !== null && form.durationSeconds > 0 ? startTime + form.durationSeconds : null
    const rate = calculateRewardRate(
        rewardAmount,
        rewardToken?.decimals ?? 18,
        form.durationSeconds
    )
    const showHourlyRate = form.durationSeconds > 0 && form.durationSeconds < 2 * SECONDS_PER_DAY

    const poolKey = useMemo(
        () =>
            form.pool
                ? {
                      token0: form.pool.token0.address,
                      token1: form.pool.token1.address,
                      fee: form.pool.fee,
                  }
                : null,
        [form.pool]
    )
    const { burnedLiquidity } = useBurnedPoolLiquidity(poolKey)
    const actualRate = useMemo(() => {
        if (!form.pool || burnedLiquidity <= 0n || form.pool.liquidity <= 0n) return null
        const stakeable = form.pool.liquidity - burnedLiquidity
        const fraction = stakeable > 0n ? Number(stakeable) / Number(form.pool.liquidity) : 0
        return { perDay: rate.perDay * fraction, perHour: rate.perHour * fraction }
    }, [form.pool, burnedLiquidity, rate])
    const blocking = primaryError(errors)
    const isBusy = isApproving || isAwaitingApproval || isPreparing || isExecuting || isConfirming

    const buttonLabel = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isApproving) return `Approving ${rewardToken?.symbol ?? 'token'}...`
        if (isAwaitingApproval) return 'Approved — creating farm...'
        if (isExecuting) return 'Confirm in wallet...'
        if (isConfirming) return 'Creating farm...'
        if (blocking && blocking !== 'NO_ACCOUNT') {
            return describeCreateIncentiveError(blocking, {
                limits,
                rewardSymbol: rewardToken?.symbol,
            })
        }
        if (isPreparing) return 'Checking...'
        return 'Create Farm'
    }

    const handleSubmit = () => {
        if (!isConnected) {
            setIsConnectModalOpen(true)
            return
        }
        setFlowNeedsApproval(needsApproval)
        setTxOpen(true)
        submit()
    }

    /**
     * useCreateIncentive exposes approve and create separately, so the flow shows both.
     * Its approval flags are already collapsed (write + receipt), hence pending rather
     * than a separate confirming state for that step.
     */
    const txSteps: TxStep[] = []
    if (flowNeedsApproval && rewardToken) {
        txSteps.push(
            approvalStep({
                token: rewardToken,
                spenderLabel: 'Farm staker',
                spender: stakerAddress,
                chainId,
                run: approve,
                flags: {
                    isPending: isApproving,
                    isSuccess: !needsApproval,
                    isError: !!error && needsApproval,
                    error,
                },
            })
        )
    }
    txSteps.push(
        actionStep({
            label: 'Create farm',
            flags: {
                isPending: isAwaitingApproval || isPreparing || isExecuting,
                isConfirming,
                isSuccess,
                isError: !!error && !needsApproval,
                error,
                hash,
            },
            run: create,
            renderStage: (phase) => (
                <TxStageRecord
                    phase={phase}
                    chainId={chainId}
                    hash={hash}
                    rows={[
                        [
                            'Pool',
                            form.pool
                                ? `${form.pool.token0.symbol} / ${form.pool.token1.symbol}`
                                : '—',
                        ],
                        ['Reward', `${form.rewardAmount || '0'} ${rewardToken?.symbol ?? ''}`],
                        ['Duration', formatDuration(form.durationSeconds)],
                    ]}
                />
            ),
        })
    )

    const isSubmitDisabled = isConnected && (isBusy || errors.length > 0)

    return (
        <>
            <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] bg-card/95 backdrop-blur-md border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            Create Mining Farm
                            <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                                {EARN_PROGRAM_LABEL[program]}
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-9rem)] pr-1">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                Pool to reward
                            </Label>
                            <FarmPoolPicker
                                value={form.pool}
                                onChange={(pool) => patch({ pool })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                Total reward
                            </Label>
                            <div className="rounded-2xl bg-muted/20 border border-border/30 p-3 space-y-2">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        inputMode="decimal"
                                        placeholder="0.0"
                                        value={form.rewardAmount}
                                        onChange={(e) => patch({ rewardAmount: e.target.value })}
                                        className="min-w-0 flex-1 bg-transparent text-xl font-semibold placeholder:text-muted-foreground/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <TokenSelect
                                        token={rewardToken}
                                        tokens={rewardTokenOptions}
                                        onSelect={(next) => patch({ rewardToken: next })}
                                        className="h-10 shrink-0 rounded-xl bg-muted/40 border-border/40 hover:bg-muted/60"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-muted-foreground">
                                        Balance:{' '}
                                        {rewardToken
                                            ? formatBalance(balance, rewardToken.decimals)
                                            : '0'}
                                    </p>
                                    {rewardToken && balance > 0n && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                patch({
                                                    rewardAmount: formatTokenAmount(
                                                        balance,
                                                        rewardToken.decimals
                                                    ),
                                                })
                                            }
                                            className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-foreground/15"
                                        >
                                            MAX
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <FarmScheduleInput
                            startMode={form.startMode}
                            scheduledStart={form.scheduledStart}
                            durationSeconds={form.durationSeconds}
                            limits={limits}
                            now={now}
                            onChange={patch}
                        />

                        <Separator />

                        <div className="space-y-2">
                            <SummaryRow
                                label="Starts"
                                value={
                                    startTime === null ? (
                                        '—'
                                    ) : (
                                        <>
                                            {formatDateTime(startTime)}
                                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                {formatRelativeTime(startTime, now)}
                                            </span>
                                        </>
                                    )
                                }
                            />
                            <SummaryRow
                                label="Ends"
                                value={endTime === null ? '—' : formatDateTime(endTime)}
                            />
                            <SummaryRow
                                label="Runs for"
                                value={
                                    form.durationSeconds > 0
                                        ? formatDuration(form.durationSeconds)
                                        : '—'
                                }
                            />
                            <SummaryRow
                                label="Reward rate"
                                value={
                                    rate.perDay > 0 && rewardToken ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <TokenIcon
                                                src={rewardToken.logo}
                                                symbol={rewardToken.symbol}
                                                size="xs"
                                            />
                                            {showHourlyRate
                                                ? `${formatRateAmount(rate.perHour, rewardToken.symbol)} / hour`
                                                : `${formatRateAmount(rate.perDay, rewardToken.symbol)} / day`}
                                        </span>
                                    ) : (
                                        '—'
                                    )
                                }
                            />
                            {actualRate && rewardToken && (
                                <SummaryRow
                                    label={
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="underline decoration-dotted underline-offset-2">
                                                    Actual reward
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-64 normal-case">
                                                This pool has burned LP from a graduated launchpad
                                                token. That liquidity can never be staked, so its
                                                share of the reward rate above will go unclaimed and
                                                return to you when the farm ends — this is the rate
                                                stakers can actually earn.
                                            </TooltipContent>
                                        </Tooltip>
                                    }
                                    value={
                                        <span className="inline-flex items-center gap-1.5">
                                            <TokenIcon
                                                src={rewardToken.logo}
                                                symbol={rewardToken.symbol}
                                                size="xs"
                                            />
                                            {showHourlyRate
                                                ? `${formatRateAmount(actualRate.perHour, rewardToken.symbol)} / hour`
                                                : `${formatRateAmount(actualRate.perDay, rewardToken.symbol)} / day`}
                                        </span>
                                    }
                                />
                            )}
                        </div>

                        <p className="rounded-xl bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                            Rewards stream to in-range liquidity for the whole period. Anything left
                            over when the farm ends comes back to your wallet — you can claim it
                            from Farms I Created once every position has unstaked.
                        </p>

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            isLoading={isBusy}
                            loadingText={buttonLabel()}
                        >
                            {buttonLabel()}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />

            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="Create mining farm"
                steps={txSteps}
                chainId={chainId}
                onDone={onClose}
            />
        </>
    )
}
