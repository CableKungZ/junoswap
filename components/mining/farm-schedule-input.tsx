'use client'

import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
    SECONDS_PER_DAY,
    durationFromSeconds,
    durationToSeconds,
    formatDuration,
    fromDateTimeLocalValue,
    toDateTimeLocalValue,
    type DurationUnit,
} from '@/lib/duration'
import { DURATION_PRESETS, TESTNET_DURATION_PRESETS } from '@/services/mining/create-incentive'
import { isTestnetChain } from '@/lib/wagmi'
import type { CreateIncentiveForm, StakerLimits, StartMode } from '@/types/earn'

const UNIT_LABEL: Record<DurationUnit, string> = {
    minutes: 'Minutes',
    hours: 'Hours',
    days: 'Days',
}

interface FarmScheduleInputProps {
    startMode: StartMode
    scheduledStart: number | null
    durationSeconds: number
    limits: StakerLimits
    now: number
    onChange: (patch: Partial<CreateIncentiveForm>) => void
}

function ChoiceChip({
    active,
    children,
    onClick,
}: {
    active: boolean
    children: React.ReactNode
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'h-9 rounded-xl border px-3 text-sm font-medium transition-colors',
                active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
        >
            {children}
        </button>
    )
}

/**
 * Schedule is expressed the way a creator thinks about it — "start now or at this local time, run
 * for this many days" — and converted to the timestamps the staker wants at the edge. Blocks and
 * raw seconds never reach the screen.
 */
export function FarmScheduleInput({
    startMode,
    scheduledStart,
    durationSeconds,
    limits,
    now,
    onChange,
}: FarmScheduleInputProps) {
    const chainId = useChainId()
    const allowMinutes = isTestnetChain(chainId)
    const presets = allowMinutes ? TESTNET_DURATION_PRESETS : DURATION_PRESETS
    const units: DurationUnit[] = allowMinutes ? ['minutes', 'hours', 'days'] : ['hours', 'days']
    const matchedPreset = presets.find((p) => p.seconds === durationSeconds)
    const [isCustom, setIsCustom] = useState(!matchedPreset)
    const [customUnit, setCustomUnit] = useState<DurationUnit>(
        durationSeconds > 0 && durationSeconds < SECONDS_PER_DAY ? 'hours' : 'days'
    )
    const [customValue, setCustomValue] = useState(() =>
        durationSeconds > 0 ? String(durationFromSeconds(durationSeconds, customUnit)) : ''
    )

    useEffect(() => {
        if (!isCustom) return
        const parsed = Number(customValue)
        const seconds = Number.isFinite(parsed) ? durationToSeconds(parsed, customUnit) : 0
        if (seconds !== durationSeconds) onChange({ durationSeconds: seconds })
        // durationSeconds is intentionally excluded: this effect owns that value while in custom mode.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customValue, customUnit, isCustom])

    const minScheduled = toDateTimeLocalValue(now + 60)
    const maxScheduled = toDateTimeLocalValue(now + limits.maxIncentiveStartLeadTime)

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Starts
                </Label>
                <div className="flex gap-2">
                    <ChoiceChip
                        active={startMode === 'now'}
                        onClick={() => onChange({ startMode: 'now' })}
                    >
                        Right away
                    </ChoiceChip>
                    <ChoiceChip
                        active={startMode === 'scheduled'}
                        onClick={() =>
                            onChange({
                                startMode: 'scheduled',
                                scheduledStart: scheduledStart ?? now + SECONDS_PER_DAY,
                            })
                        }
                    >
                        Pick a time
                    </ChoiceChip>
                </div>
                {startMode === 'scheduled' && (
                    <div className="space-y-1.5 pt-1">
                        <Input
                            type="datetime-local"
                            value={scheduledStart ? toDateTimeLocalValue(scheduledStart) : ''}
                            min={minScheduled}
                            max={maxScheduled}
                            onChange={(e) =>
                                onChange({
                                    scheduledStart: fromDateTimeLocalValue(e.target.value),
                                })
                            }
                            className="h-11 rounded-xl border border-border/40 bg-muted/30 px-3"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Your local time · up to{' '}
                            {formatDuration(limits.maxIncentiveStartLeadTime)} from now
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Runs for
                </Label>
                <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                        <ChoiceChip
                            key={preset.seconds}
                            active={!isCustom && durationSeconds === preset.seconds}
                            onClick={() => {
                                setIsCustom(false)
                                onChange({ durationSeconds: preset.seconds })
                            }}
                        >
                            {preset.label}
                        </ChoiceChip>
                    ))}
                    <ChoiceChip active={isCustom} onClick={() => setIsCustom(true)}>
                        Custom
                    </ChoiceChip>
                </div>
                {isCustom && (
                    <div className="flex items-center gap-2 pt-1">
                        <Input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            autoFocus
                            placeholder="0"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            className="h-11 flex-1 rounded-xl border border-border/40 bg-muted/30 px-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <div className="flex gap-1">
                            {units.map((unit) => (
                                <ChoiceChip
                                    key={unit}
                                    active={customUnit === unit}
                                    onClick={() => setCustomUnit(unit)}
                                >
                                    {UNIT_LABEL[unit]}
                                </ChoiceChip>
                            ))}
                        </div>
                    </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                    Max {formatDuration(limits.maxIncentiveDuration)} on this chain
                </p>
            </div>
        </div>
    )
}
