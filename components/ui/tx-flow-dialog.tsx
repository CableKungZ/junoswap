'use client'

import { useState } from 'react'
import { Check, Loader2, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExplorerTxUrl } from '@/lib/explorer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toastSuccess } from '@/lib/toast'
import { parseRevertReason, fullErrorLog, type TxPhase } from '@/lib/tx-flow'

export interface TxStep {
    label: string
    phase: TxPhase
    hash?: `0x${string}`
    error?: unknown
    /** Runs this step. Drives the footer button once the step before it lands. */
    run: () => void
    /** The stage to show while this step is the live one. */
    renderStage: (phase: TxPhase) => React.ReactNode
}

export interface TxFlowDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    /**
     * One entry per signature the action actually needs. An allowance that is
     * already granted should be left out rather than passed pre-ticked.
     */
    steps: readonly TxStep[]
    chainId: number
    /** Called from the footer once the last step is confirmed. */
    onDone?: () => void
}

function StepGlyph({ phase }: { phase: TxPhase }) {
    if (phase === 'success') return <Check className="h-3.5 w-3.5" strokeWidth={3} />
    if (phase === 'error' || phase === 'sim-error')
        return <X className="h-3.5 w-3.5" strokeWidth={3} />
    if (phase === 'idle') return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
    return <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
}

const STEP_ACCENT: Record<TxPhase, string> = {
    idle: 'border-border text-muted-foreground',
    pending: 'border-primary text-primary',
    confirming: 'border-primary text-primary',
    success: 'border-positive text-positive',
    error: 'border-negative text-negative',
    'sim-error': 'border-negative text-negative',
}

const STEP_NOTE: Record<TxPhase, string> = {
    idle: '',
    pending: 'in wallet',
    confirming: '',
    success: '',
    error: 'reverted',
    'sim-error': 'not sent',
}

/**
 * A revert caught in simulation never reaches a block, so its reason is known with no
 * gas spent and no wallet prompt. That is worth the whole log, not a truncated toast.
 */
function TxErrorPanel({ error }: { error: unknown }) {
    const [open, setOpen] = useState(false)
    const log = fullErrorLog(error)
    return (
        <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2.5">
                <span className="break-words text-sm font-semibold text-negative">
                    {parseRevertReason(error)}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    simulate
                </span>
            </div>
            {open && (
                <pre className="max-h-[104px] overflow-auto rounded-[calc(var(--radius)-3px)] border border-border bg-muted px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                    {log}
                </pre>
            )}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground underline underline-offset-[3px] hover:text-foreground"
                >
                    {open ? '− Hide full log' : '+ Show full log'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard.writeText(log)
                        toastSuccess('Error copied to clipboard')
                    }}
                    className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground underline underline-offset-[3px] hover:text-foreground"
                >
                    Copy
                </button>
            </div>
        </div>
    )
}

/**
 * One dialog for every on-chain action. It walks however many signatures the action
 * needs — a single unstake or approve → approve → mint — and the stage follows
 * whichever step is live.
 */
export function TxFlowDialog({
    open,
    onOpenChange,
    title,
    steps,
    chainId,
    onDone,
}: TxFlowDialogProps) {
    if (steps.length === 0) return null

    // Once every step has landed there is no unfinished step to point at, so the last
    // one stays live and keeps showing its result.
    const pendingIndex = steps.findIndex((s) => s.phase !== 'success')
    const allDone = pendingIndex === -1
    const liveIndex = allDone ? steps.length - 1 : pendingIndex
    const live = steps[liveIndex]!
    const isLast = liveIndex === steps.length - 1
    const failed = live.phase === 'error' || live.phase === 'sim-error'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn('max-w-sm gap-0 p-0', live.phase === 'error' && 'animate-tx-shake')}
            >
                <DialogHeader className="px-5 pt-4">
                    <DialogTitle className="text-base">{title}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-3.5 px-5 pb-5 pt-4">
                    {live.phase === 'sim-error' ? (
                        <div className="grid min-h-[148px] content-center gap-3.5 rounded-[calc(var(--radius)-1px)] border border-border bg-secondary/40 px-[18px] py-4">
                            <TxErrorPanel error={live.error} />
                        </div>
                    ) : (
                        live.renderStage(live.phase)
                    )}

                    <div className="grid">
                        {steps.map((step, i) => (
                            <div key={step.label}>
                                {i > 0 && (
                                    <div className="relative mx-auto h-5 w-[1.5px] overflow-hidden bg-border">
                                        {steps[i - 1]!.phase === 'success' && (
                                            <span className="absolute inset-0 scale-y-0 bg-positive animate-tx-srail" />
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-[26px_1fr_auto] items-center gap-3">
                                    <span
                                        className={cn(
                                            'grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] bg-background',
                                            STEP_ACCENT[step.phase]
                                        )}
                                    >
                                        <StepGlyph phase={step.phase} />
                                    </span>
                                    <span
                                        className={cn(
                                            'text-sm font-medium',
                                            step.phase === 'idle' && 'text-muted-foreground'
                                        )}
                                    >
                                        {step.label}
                                    </span>
                                    <span className="font-mono text-[11.5px] text-muted-foreground">
                                        {step.hash
                                            ? `${step.hash.slice(0, 6)}…${step.hash.slice(-3)}`
                                            : STEP_NOTE[step.phase]}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-2">
                        {failed && (
                            <Button className="w-full" onClick={live.run}>
                                Try again
                            </Button>
                        )}

                        {live.phase === 'pending' && (
                            <Button variant="outline" className="w-full" disabled>
                                Confirm in your wallet…
                            </Button>
                        )}

                        {live.phase === 'confirming' && (
                            <Button variant="outline" className="w-full" disabled>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Confirming…
                            </Button>
                        )}

                        {/* The primary button always names the next signature, so nobody
                            signs something the dialog never spelled out. */}
                        {live.phase === 'success' && !isLast && (
                            <Button className="w-full" onClick={steps[liveIndex + 1]!.run}>
                                {steps[liveIndex + 1]!.label}
                            </Button>
                        )}

                        {live.phase === 'idle' && (
                            <Button className="w-full" onClick={live.run}>
                                {live.label}
                            </Button>
                        )}

                        {allDone && (
                            <Button
                                className="w-full"
                                onClick={() => {
                                    onDone?.()
                                    onOpenChange(false)
                                }}
                            >
                                Done
                            </Button>
                        )}

                        {live.hash && (
                            <a
                                href={getExplorerTxUrl(chainId, live.hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] border border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
                            >
                                View on explorer
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
