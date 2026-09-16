'use client'

import { Check, Loader2, X } from 'lucide-react'
import type { Address } from 'viem'
import { cn } from '@/lib/utils'
import { formatFeeTier } from '@/lib/liquidity-helpers'
import { getExplorerTxUrl } from '@/lib/explorer'
import { TokenIcon } from '@/components/ui/token-icon'
import { useCountUp } from '@/hooks/useCountUp'
import type { TxPhase } from '@/lib/tx-flow'

interface TokenRef {
    symbol: string
    logoURI?: string | null
}

export interface TxTokenSide {
    kind: 'token'
    token: TokenRef
    /** Already formatted for display — the stage never does its own rounding. */
    amount: string
    /** When set, the amount counts up to this figure while the tx confirms. */
    countTo?: number
    /** Decimals to render the counting value with. Defaults to 2. */
    displayDecimals?: number
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

/** A value the chain has not returned yet is a skeleton, never a zero. */
function Skeleton({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'inline-block h-5 w-16 rounded bg-foreground/[0.07] animate-tx-shimmer',
                className
            )}
        />
    )
}

function Amount({ side, phase }: { side: TxTokenSide | TxContractSide; phase: TxPhase }) {
    const counting = side.kind === 'token' && side.countTo !== undefined && phase === 'confirming'
    const target = side.kind === 'token' ? (side.countTo ?? 0) : 0
    const decimals = side.kind === 'token' ? (side.displayDecimals ?? 2) : 2
    const counted = useCountUp(target, counting)

    if (phase === 'pending') return <Skeleton />
    return (
        <span
            className={cn(
                'whitespace-nowrap text-xl font-semibold leading-tight tracking-tight tabular-nums'
            )}
        >
            {counting
                ? counted.toLocaleString('en-US', {
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                  })
                : side.amount}
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
                <TokenIcon src={side.token0.logoURI} symbol={side.token0.symbol} size="xs" />
                <TokenIcon
                    src={side.token1.logoURI}
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

function Side({ side, phase }: { side: TxSide; phase: TxPhase }) {
    if (side.kind === 'position')
        return (
            <div className="grid min-w-0 justify-items-center gap-1.5">
                <PositionChip side={side} />
            </div>
        )

    return (
        <div className="grid min-w-0 justify-items-center gap-1.5">
            {side.kind === 'token' ? (
                <TokenIcon src={side.token.logoURI} symbol={side.token.symbol} size="sm" />
            ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-secondary font-mono text-[9px] text-muted-foreground">
                    {side.address ? shortAddress(side.address).slice(0, 5) : '0x'}
                </span>
            )}
            <Amount side={side} phase={phase} />
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {side.kind === 'token' ? side.token.symbol : side.label}
            </span>
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
    const width =
        phase === 'success' ? 'w-full' : phase === 'error' ? 'w-2/5' : phase === 'idle' ? 'w-0' : ''
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
                    className={cn(
                        'h-full rounded-sm transition-[width] duration-500',
                        phase === 'success' ? 'bg-positive' : 'bg-primary',
                        phase === 'sim-error' ? 'w-0' : width,
                        phase === 'confirming' && 'w-[8%] animate-tx-meter',
                        phase === 'pending' && 'w-[8%]'
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
        <div className="relative grid min-h-[148px] content-center gap-3.5 overflow-hidden rounded-[calc(var(--radius)-1px)] border border-border bg-secondary/40 px-[18px] pb-[18px] pt-4">
            {phase === 'success' && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,hsl(var(--positive)/0.16)_50%,transparent_62%)] opacity-0 animate-tx-sheen"
                />
            )}
            <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
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
                <Side side={from} phase={phase} />
                <Rail phase={phase} />
                <div className={cn(phase === 'success' && 'animate-tx-land')}>
                    <Side side={to} phase={phase} />
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
                        {phase === 'pending' ? (
                            <Skeleton className="h-4 w-20" />
                        ) : (
                            <span className="font-semibold tabular-nums">{value}</span>
                        )}
                    </div>
                ))}
            </div>
        </StageShell>
    )
}
