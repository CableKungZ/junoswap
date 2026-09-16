'use client'

import { cn } from '@/lib/utils'
import type { LaunchpadPlatform, LaunchpadPlatformFilter } from '@/types/launchpad'
import { PlatformLogo } from './platform-logo'

interface PlatformFilterProps {
    value: LaunchpadPlatformFilter
    onChange: (value: LaunchpadPlatformFilter) => void
}

const PLATFORM_OPTIONS: {
    key: LaunchpadPlatformFilter
    label: string
    logo?: LaunchpadPlatform
}[] = [
    { key: 'all', label: 'All' },
    { key: 'junoswap', label: 'Junoswap', logo: 'junoswap' },
    { key: 'third-party', label: 'Third-party', logo: 'durianfun' },
]

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted/50 p-1">
            {PLATFORM_OPTIONS.map(({ key, label, logo }) => (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                        value === key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {logo && <PlatformLogo platform={logo} className="h-4 w-4" />}
                    {label}
                </button>
            ))}
        </div>
    )
}
