'use client'

import { cn } from '@/lib/utils'
import type { LaunchpadPlatformFilter } from '@/types/launchpad'

interface PlatformFilterProps {
    value: LaunchpadPlatformFilter
    onChange: (value: LaunchpadPlatformFilter) => void
}

const PLATFORM_OPTIONS: { key: LaunchpadPlatformFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'junoswap', label: 'Junoswap' },
    { key: 'third-party', label: 'Third-party' },
]

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted/50 p-1">
            {PLATFORM_OPTIONS.map(({ key, label }) => (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                        value === key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
