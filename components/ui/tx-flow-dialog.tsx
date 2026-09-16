'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { toast, useSonner } from 'sonner'
import { Check, Loader2, X, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExplorerTxUrl } from '@/lib/explorer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TxStageFlow } from '@/components/ui/tx-stage'
import { parseRevertReason, fullErrorLog, txPhase, type TxPhase, type TxFlags } from '@/lib/tx-flow'
import type { Address } from 'viem'

const COPY_TOAST_ID = 'tx-flow-copy'

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

/**
 * The step every action that spends an ERC20 starts with. Identical everywhere, so it
 * lives here rather than being retyped at each call site.
 */
export function approvalStep(input: {
    token: { symbol: string; logo?: string | null }
    spenderLabel: string
    spender?: Address
    chainId: number
    run: () => void
    flags: TxFlags
}): TxStep {
    const { token, spenderLabel, spender, chainId, run, flags } = input
    return {
        label: `Approve ${token.symbol}`,
        phase: txPhase(flags),
        hash: flags.hash,
        error: flags.simulationError ?? flags.error,
        run,
        renderStage: (phase) => (
            <TxStageFlow
                phase={phase}
                chainId={chainId}
                hash={flags.hash}
                from={{ kind: 'token', token, amount: 'Wallet' }}
                to={{
                    kind: 'contract',
                    label: spenderLabel,
                    address: spender,
                    amount: 'Unlimited',
                }}
            />
        ),
    }
}

/** The step that does the work. Only the stage differs between actions. */
export function actionStep(input: {
    label: string
    flags: TxFlags
    run: () => void
    renderStage: (phase: TxPhase) => React.ReactNode
}): TxStep {
    return {
        label: input.label,
        phase: txPhase(input.flags),
        hash: input.flags.hash,
        error: input.flags.simulationError ?? input.flags.error,
        run: input.run,
        renderStage: input.renderStage,
    }
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
                        toast.success('Error copied to clipboard', { id: COPY_TOAST_ID })
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
    // Every hook has to run before the empty-steps bail-out below, so the live step is
    // resolved defensively rather than after an early return.
    const pendingIndex = steps.findIndex((s) => s.phase !== 'success')
    const allDone = steps.length > 0 && pendingIndex === -1
    const liveIndex = allDone ? steps.length - 1 : Math.max(0, pendingIndex)
    const live = steps[liveIndex]
    const phase = live?.phase ?? 'idle'

    // Call sites still toast their results for flows without this dialog; while it is open
    // it already shows each result (with the full log), so those toasts only repeat it.
    // Layout effect so they are gone before paint. Toasts from before it opened are left.
    const { toasts } = useSonner()
    const toastsBeforeOpen = useRef<Set<string | number> | null>(null)
    useLayoutEffect(() => {
        if (!open) {
            toastsBeforeOpen.current = null
            return
        }
        toastsBeforeOpen.current ??= new Set(toasts.map((t) => t.id))
        for (const t of toasts) {
            if (t.id !== COPY_TOAST_ID && !toastsBeforeOpen.current.has(t.id)) toast.dismiss(t.id)
        }
    }, [open, toasts])

    if (!live) return null

    const isLast = liveIndex === steps.length - 1
    const failed = phase === 'error' || phase === 'sim-error'
    // A signature is in the wallet or a transaction is in a block. Closing here would
    // strand a flow the user cannot get back to, so the dialog refuses to be dismissed.
    const isBusyNow = phase === 'pending' || phase === 'confirming'

    const finish = () => {
        onDone?.()
        onOpenChange(false)
    }

    const handleOpenChange = (next: boolean) => {
        if (next) {
            onOpenChange(true)
            return
        }
        if (isBusyNow) return
        // Escape and the corner X have to mean what Done means, or a finished flow leaves
        // its form unreset and its parent dialog open behind it.
        if (allDone) {
            finish()
            return
        }
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    'max-w-lg gap-0 overflow-hidden rounded-[1.65rem] border-white/10 bg-background/95 p-0 shadow-2xl shadow-black/30 backdrop-blur-xl',
                    phase === 'error' && 'animate-tx-shake',
                    isBusyNow && '[&>button]:hidden'
                )}
                onInteractOutside={(e) => isBusyNow && e.preventDefault()}
                onEscapeKeyDown={(e) => isBusyNow && e.preventDefault()}
            >
                <DialogHeader className="relative overflow-hidden border-b border-border/60 px-6 pb-5 pt-6">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
                    />
                    <div className="relative">
                        <div className="grid gap-2">
                            <DialogTitle className="text-xl font-semibold tracking-tight">
                                {title}
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground">
                                Review the details below while your transaction completes.
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-4 px-6 pb-6 pt-5">
                    {phase === 'sim-error' ? (
                        <div className="grid min-h-[148px] content-center gap-3.5 rounded-[calc(var(--radius)-1px)] border border-border bg-secondary/40 px-[18px] py-4">
                            <TxErrorPanel error={live.error} />
                        </div>
                    ) : (
                        live.renderStage(phase)
                    )}

                    <div className="grid">
                        {steps.map((step, i) => (
                            <div key={step.label}>
                                {i > 0 && (
                                    <div className="relative mx-auto h-5 w-[2px] overflow-hidden rounded-full bg-border/70">
                                        {steps[i - 1]!.phase === 'success' && (
                                            <span className="absolute inset-0 scale-y-0 bg-positive animate-tx-srail" />
                                        )}
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        'grid grid-cols-[30px_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                                        step.phase === 'success' &&
                                            'border-positive/20 bg-positive/[0.045]',
                                        step.phase === 'pending' &&
                                            'border-primary/25 bg-primary/[0.06]',
                                        (step.phase === 'error' || step.phase === 'sim-error') &&
                                            'border-negative/25 bg-negative/[0.06]',
                                        step.phase === 'idle' && 'border-border/60 bg-muted/20'
                                    )}
                                >
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

                        {phase === 'pending' && (
                            <Button variant="outline" className="w-full" disabled>
                                Confirm in your wallet…
                            </Button>
                        )}

                        {phase === 'confirming' && (
                            <Button variant="outline" className="w-full" disabled>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Confirming…
                            </Button>
                        )}

                        {/* The primary button always names the next signature, so nobody
                            signs something the dialog never spelled out. */}
                        {phase === 'success' && !isLast && (
                            <Button className="w-full" onClick={steps[liveIndex + 1]!.run}>
                                {steps[liveIndex + 1]!.label}
                            </Button>
                        )}

                        {phase === 'idle' && (
                            <Button className="w-full" onClick={live.run}>
                                {live.label}
                            </Button>
                        )}

                        {allDone && (
                            <Button className="w-full" onClick={finish}>
                                Done
                            </Button>
                        )}

                        {live.hash && (
                            <a
                                href={getExplorerTxUrl(chainId, live.hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-muted/20 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                            >
                                View on explorer
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
