'use client'

import { useChainId } from 'wagmi'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/lib/duration'
import { isTestnetChain } from '@/lib/wagmi'
import { cn } from '@/lib/utils'

export type ScheduleUnit = 'minutes' | 'days'

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
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {label}
                </Label>
                {allowMinutes && (
                    <div className="flex gap-1">
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
                )}
            </div>
            <Input
                type="number"
                min={min}
                step="any"
                inputMode="decimal"
                value={value}
                disabled={disabled}
                onChange={(e) => onValueChange(e.target.value)}
            />
        </div>
    )
}
