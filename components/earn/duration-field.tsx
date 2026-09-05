'use client'

import { useChainId } from 'wagmi'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/lib/duration'
import { isTestnetChain } from '@/lib/wagmi'
import { cn } from '@/lib/utils'

export type ScheduleUnit = 'minutes' | 'days'

/**
 * The base Input primitive ships with no border at all, so every schedule field drew as bare text
 * on the dialog's own background. These are the fields a creator types money and time into — they
 * get an explicit box.
 */
export const FIELD_CLASS =
    'h-10 rounded-xl border border-border/70 bg-background/40 focus-visible:border-primary/70'

/**
 * One labelled field. The label row is a fixed height because some of these fields carry a unit
 * toggle beside the label and some do not — without it the boxes in a two-column grid start at
 * different heights and read as mismatched.
 */
export function FieldShell({
    label,
    aside,
    children,
}: {
    label: string
    aside?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="space-y-2">
            <div className="flex h-5 items-center justify-between gap-2">
                <Label className="truncate text-xs uppercase tracking-wider text-muted-foreground">
                    {label}
                </Label>
                {aside}
            </div>
            {children}
        </div>
    )
}

export function unitSeconds(unit: ScheduleUnit): number {
    return unit === 'minutes' ? SECONDS_PER_MINUTE : SECONDS_PER_DAY
}

/**
 * A schedule length in the unit the chain deserves: days on mainnet, and minutes as well on a
 * test chain, where an epoch has to be watchable from start to finish in one sitting.
 */
export function DurationField({
    label,
    value,
    unit,
    onValueChange,
    onUnitChange,
    disabled,
    min = '0',
}: {
    label: string
    value: string
    unit: ScheduleUnit
    onValueChange: (value: string) => void
    onUnitChange: (unit: ScheduleUnit) => void
    disabled?: boolean
    min?: string
}) {
    const allowMinutes = isTestnetChain(useChainId())
    return (
        <FieldShell
            label={label}
            aside={
                allowMinutes && (
                    <div className="flex shrink-0 gap-1">
                        {(['minutes', 'days'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => onUnitChange(option)}
                                className={cn(
                                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors',
                                    unit === option
                                        ? 'bg-foreground/10 text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )
            }
        >
            <Input
                type="number"
                min={min}
                step="any"
                inputMode="decimal"
                value={value}
                disabled={disabled}
                onChange={(e) => onValueChange(e.target.value)}
                className={FIELD_CLASS}
            />
        </FieldShell>
    )
}

/** Seconds since epoch for a `datetime-local` value, or 0 — which the pool reads as "start now". */
export function startTimeSeconds(mode: StartMode, localValue: string): bigint {
    if (mode === 'now' || !localValue) return 0n
    const ms = new Date(localValue).getTime()
    if (!Number.isFinite(ms)) return 0n
    return BigInt(Math.floor(ms / 1000))
}

export type StartMode = 'now' | 'scheduled'

/**
 * When the epoch begins accruing. The pool treats 0 (and any past timestamp) as "immediately",
 * so the toggle is the whole feature — the picker only appears once a later start is chosen.
 */
export function StartField({
    mode,
    value,
    onModeChange,
    onValueChange,
    disabled,
}: {
    mode: StartMode
    value: string
    onModeChange: (mode: StartMode) => void
    onValueChange: (value: string) => void
    disabled?: boolean
}) {
    return (
        <FieldShell
            label="Starts"
            aside={
                <div className="flex shrink-0 gap-1">
                    {(
                        [
                            ['now', 'Now'],
                            ['scheduled', 'Later'],
                        ] as const
                    ).map(([option, label]) => (
                        <button
                            key={option}
                            type="button"
                            disabled={disabled}
                            onClick={() => onModeChange(option)}
                            className={cn(
                                'rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                                mode === option
                                    ? 'bg-foreground/10 text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            }
        >
            {mode === 'scheduled' ? (
                <DateTimePicker
                    value={value}
                    onChange={onValueChange}
                    disabled={disabled}
                    placeholder="Pick the start"
                    title="When does this epoch start?"
                    min={new Date()}
                />
            ) : (
                <Input value="Immediately" disabled readOnly className={FIELD_CLASS} />
            )}
        </FieldShell>
    )
}
