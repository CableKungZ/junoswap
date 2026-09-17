'use client'

import { Check, Loader2, X } from 'lucide-react'
import type { Address } from 'viem'
import { cn } from '@/lib/utils'
import { formatFeeTier } from '@/lib/liquidity-helpers'
import { getExplorerTxUrl } from '@/lib/explorer'
import { TokenIcon } from '@/components/ui/token-icon'
import { formatStageText, type TxPhase } from '@/lib/tx-flow'

interface TokenRef {
    symbol: string
    logo?: string | null
}

export interface TxTokenSide {
    kind: 'token'
    token: TokenRef
    /** Already formatted for display — the stage never does its own rounding. */
    amount: string
}

export interface TxContractSide {
    kind: 'contract'
    label: string
    address?: Address
    /** What this side represents once the tx lands — "Unlimited", "Staked", a total. */
    amount: string
}

export interface TxPositionSide {
    kind: 'position'
    tokenId: bigint
    /** Above 1, renders the fanning stack a multicall over several positions deserves. */
    count?: number
    feeTier: number
    inRange: boolean
    token0: TokenRef
    token1: TokenRef
}

export type TxSide = TxTokenSide | TxContractSide | TxPositionSide

// Block time plus ~0.5s. The bar only estimates; success still waits for the receipt, and
// snaps the bar to full once it actually lands.
const CONFIRM_MS: Record<number, number> = {
    96: 3500, // KUB mainnet, 3s blocks
    25925: 3500, // KUB testnet, 3s blocks
    8899: 5500, // JBC, 5s blocks
    8453: 2500, // Base, 2s blocks
    480: 2500, // World Chain, 2s blocks
    56: 1250, // BSC, 0.75s blocks
}

const shortAddress = (address: Address) => `${address.slice(0, 5)}…${address.slice(-3)}`

const STATUS_LABEL: Record<TxPhase, string> = {
    idle: 'Ready',
    pending: 'Waiting for your wallet',
    confirming: 'Confirming on-chain',
    success: 'Confirmed',
    error: 'Reverted on-chain',
    'sim-error': 'Simulation failed · nothing sent',
}

const LAMP_COLOR: Record<TxPhase, string> = {
    idle: 'bg-muted-foreground',
    pending: 'bg-primary animate-tx-lamp',
    confirming: 'bg-primary animate-tx-lamp',
    success: 'bg-positive',
    error: 'bg-negative',
    'sim-error': 'bg-negative',
}

const ACCENT: Record<TxPhase, string> = {
    idle: 'text-muted-foreground border-border',
    pending: 'text-primary border-primary',
    confirming: 'text-primary border-primary',
    success: 'text-positive border-positive',
    error: 'text-negative border-negative',
    'sim-error': 'text-negative border-negative',
}

function PhaseGlyph({ phase }: { phase: TxPhase }) {
    if (phase === 'success') return <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
    if (phase === 'error' || phase === 'sim-error')
        return <X className="h-2.5 w-2.5" strokeWidth={3.5} />
    if (phase === 'idle') return <span className="h-1 w-1 rounded-full bg-current" />
    return <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={3} />
}

function Amount({ side }: { side: TxTokenSide | TxContractSide }) {
    return (
        <span
            title={side.amount}
            className="max-w-full truncate whitespace-nowrap text-xl font-semibold leading-tight tracking-tight tabular-nums"
        >
            {formatStageText(side.amount)}
        </span>
    )
}

function PositionChip({ side }: { side: TxPositionSide }) {
    const stacked = (side.count ?? 1) > 1
    return (
        <div className="relative grid justify-items-center gap-1.5">
            {stacked && (
                <>
                    <span
                        style={
                            { '--fan-x': '-9px', '--fan-rotate': '-5deg' } as React.CSSProperties
                        }
                        className="absolute left-1/2 top-0.5 -z-10 h-6 w-9 -translate-x-1/2 rounded-full border border-border bg-secondary animate-tx-fan"
                    />
                    <span
                        style={{ '--fan-x': '9px', '--fan-rotate': '5deg' } as React.CSSProperties}
                        className="absolute left-1/2 top-0.5 -z-10 h-6 w-9 -translate-x-1/2 rounded-full border border-border bg-secondary animate-tx-fan"
                    />
                </>
            )}
            <div className="flex -space-x-2">
                <TokenIcon src={side.token0.logo} symbol={side.token0.symbol} size="xs" />
                <TokenIcon
                    src={side.token1.logo}
                    symbol={side.token1.symbol}
                    size="xs"
                    className="ring-2 ring-secondary"
                />
            </div>
            <span className="text-[15px] font-semibold leading-tight tabular-nums">
                {stacked ? `${side.count} positions` : `Position #${side.tokenId.toString()}`}
            </span>
            <span className="whitespace-nowrap font-mono text-[9.5px] tracking-wider text-muted-foreground">
                {formatFeeTier(side.feeTier)} ·{' '}
                <span className={side.inRange ? 'text-positive' : undefined}>
                    {side.inRange ? 'In range' : 'Out of range'}
                </span>
            </span>
        </div>
    )
}

function Side({ side }: { side: TxSide }) {
    if (side.kind === 'position')
        return (
            <div className="grid min-w-0 justify-items-center gap-1.5">
                <PositionChip side={side} />
            </div>
        )

    return (
        <div className="grid min-w-0 justify-items-center gap-1.5">
            {side.kind === 'token' ? (
                <TokenIcon src={side.token.logo} symbol={side.token.symbol} size="sm" />
            ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-secondary font-mono text-[9px] text-muted-foreground">
                    {side.address ? shortAddress(side.address).slice(0, 5) : '0x'}
                </span>
            )}
            <Amount side={side} />
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {side.kind === 'token' ? side.token.symbol : side.label}
            </span>
            {side.kind === 'contract' && side.address && (
                <span
                    title={side.address}
                    className="-mt-1 whitespace-nowrap font-mono text-[10px] text-muted-foreground/70"
                >
                    {`${side.address.slice(0, 6)}…${side.address.slice(-4)}`}
                </span>
            )}
        </div>
    )
}

function Rail({ phase }: { phase: TxPhase }) {
    return (
        <div
            className={cn(
                'relative h-0.5 w-16 shrink-0 rounded-sm',
                phase === 'error' || phase === 'sim-error'
                    ? 'bg-[repeating-linear-gradient(90deg,hsl(var(--negative))_0_5px,transparent_5px_10px)]'
                    : 'bg-border'
            )}
        >
            {phase === 'confirming' && (
                <span className="absolute inset-0 rounded-sm bg-primary animate-tx-rail-run" />
            )}
            {phase === 'success' && (
                <span className="absolute inset-0 rounded-sm bg-positive animate-tx-rail-fill" />
            )}
            <span
                className={cn(
                    'absolute right-0 top-1/2 -mt-2 grid h-4 w-4 place-items-center rounded-full border-[1.5px] bg-secondary',
                    ACCENT[phase]
                )}
            >
                <PhaseGlyph phase={phase} />
            </span>
        </div>
    )
}

/**
 * The bottom line of every stage. It reports only what we actually know — the hash
 * once one exists, and what the app is waiting on. No invented confirmation counts.
 */
function Meter({
    phase,
    hash,
    chainId,
}: {
    phase: TxPhase
    hash?: `0x${string}`
    chainId: number
}) {
    const width: Record<TxPhase, string> = {
        idle: 'w-0',
        pending: 'w-[8%]',
        confirming: 'w-full',
        success: 'w-full',
        error: 'w-2/5',
        'sim-error': 'w-0',
    }
    // A width transition rather than a keyframe: when the receipt lands mid-run, the bar
    // finishes from wherever it is instead of restarting.
    // Confirmed cancels the transition rather than shortening it: confirming already targets
    // w-full, so the width doesn't change and a running transition would keep crawling.
    // Dropping the property ends it at its end value on the spot.
    const duration = phase === 'confirming' ? (CONFIRM_MS[chainId] ?? 3500) : 300
    const note: Record<TxPhase, string> = {
        idle: '',
        pending: 'awaiting signature',
        confirming: 'waiting for receipt',
        success: 'confirmed',
        error: 'reverted',
        'sim-error': 'no gas spent',
    }
    return (
        <div className="grid gap-1.5">
            <div className="h-[3px] overflow-hidden rounded-sm bg-border">
                <div
                    style={{
                        transitionDuration: `${duration}ms`,
                        transitionTimingFunction: phase === 'confirming' ? 'linear' : 'ease-out',
                    }}
                    className={cn(
                        'h-full rounded-sm',
                        phase === 'success'
                            ? 'bg-positive transition-none'
                            : 'bg-primary transition-[width] motion-reduce:transition-none',
                        width[phase]
                    )}
                />
            </div>
            <div className="flex justify-between font-mono text-[10px] tracking-wide text-muted-foreground">
                {hash ? (
                    <a
                        href={getExplorerTxUrl(chainId, hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground"
                    >
                        {hash.slice(0, 6)}…{hash.slice(-3)}
                    </a>
                ) : (
                    <span>not broadcast</span>
                )}
                <span>{note[phase]}</span>
            </div>
        </div>
    )
}

interface StageShellProps {
    phase: TxPhase
    hash?: `0x${string}`
    chainId: number
    children: React.ReactNode
}

function StageShell({ phase, hash, chainId, children }: StageShellProps) {
    return (
        <div
            className={cn(
                'relative grid min-h-[172px] content-center gap-4 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-secondary/80 via-secondary/35 to-background px-5 pb-5 pt-5 shadow-inner',
                phase === 'pending' && 'border-primary/25',
                phase === 'confirming' && 'border-primary/35 shadow-primary/5',
                phase === 'success' && 'border-positive/30',
                (phase === 'error' || phase === 'sim-error') && 'border-negative/30'
            )}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-primary/[0.08] blur-3xl"
            />
            {phase === 'success' && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,hsl(var(--positive)/0.16)_50%,transparent_62%)] opacity-0 animate-tx-sheen"
                />
            )}
            <div className="relative flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', LAMP_COLOR[phase])} />
                {STATUS_LABEL[phase]}
            </div>
            {children}
            <Meter phase={phase} hash={hash} chainId={chainId} />
        </div>
    )
}

export interface TxStageFlowProps {
    phase: TxPhase
    from: TxSide
    to: TxSide
    hash?: `0x${string}`
    chainId: number
}

/** Value moving between two named things: a token amount, a contract, a v3 position. */
export function TxStageFlow({ phase, from, to, hash, chainId }: TxStageFlowProps) {
    return (
        <StageShell phase={phase} hash={hash} chainId={chainId}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <Side side={from} />
                <Rail phase={phase} />
                <div className={cn(phase === 'success' && 'animate-tx-land')}>
                    <Side side={to} />
                </div>
            </div>
        </StageShell>
    )
}

export interface TxStageRecordProps {
    phase: TxPhase
    rows: readonly (readonly [string, string])[]
    hash?: `0x${string}`
    chainId: number
}

/** A new on-chain object being written — a pool, a position, a token — row by row. */
export function TxStageRecord({ phase, rows, hash, chainId }: TxStageRecordProps) {
    const staggered = phase === 'confirming' || phase === 'success'
    return (
        <StageShell phase={phase} hash={hash} chainId={chainId}>
            <div className="grid gap-1.5">
                {rows.map(([label, value], i) => (
                    <div
                        key={label}
                        style={{ animationDelay: `${i * 90}ms` }}
                        className={cn(
                            'flex items-baseline justify-between gap-3.5 border-b border-border pb-1.5 text-[13px] last:border-b-0 last:pb-0',
                            staggered && 'animate-tx-row-in'
                        )}
                    >
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                            {label}
                        </span>
                        <span title={value} className="min-w-0 truncate font-semibold tabular-nums">
                            {formatStageText(value)}
                        </span>
                    </div>
                ))}
            </div>
        </StageShell>
    )
}
