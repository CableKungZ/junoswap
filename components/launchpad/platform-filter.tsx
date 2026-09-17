'use client'

import { Check, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { LaunchpadPlatform } from '@/types/launchpad'
import { PlatformLogo } from './platform-logo'

export const ALL_PLATFORMS: LaunchpadPlatform[] = ['junoswap', 'durianfun']

export const PLATFORM_LABEL: Record<LaunchpadPlatform, string> = {
    junoswap: 'Junoswap',
    durianfun: 'DurianFun',
}

interface PlatformFilterProps {
    value: LaunchpadPlatform[]
    onChange: (value: LaunchpadPlatform[]) => void
}

function Row({
    checked,
    onClick,
    children,
}: {
    checked: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onClick}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
            <span
                aria-hidden
                className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                )}
            >
                {checked && <Check className="h-3 w-3" />}
            </span>
            {children}
        </button>
    )
}

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
    const allChecked = ALL_PLATFORMS.every((p) => value.includes(p))
    // Unticking the last platform would empty the list, so it falls back to everything.
    const toggle = (platform: LaunchpadPlatform) => {
        const next = value.includes(platform)
            ? value.filter((p) => p !== platform)
            : [...value, platform]
        onChange(next.length === 0 ? ALL_PLATFORMS : next)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Filter by platform"
                    className={cn(
                        'relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-muted/50 transition-colors hover:text-foreground',
                        allChecked ? 'text-muted-foreground' : 'text-foreground'
                    )}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    {!allChecked && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1.5">
                <Row checked={allChecked} onClick={() => onChange(ALL_PLATFORMS)}>
                    All
                </Row>
                {ALL_PLATFORMS.map((platform) => (
                    <Row
                        key={platform}
                        checked={value.includes(platform)}
                        onClick={() => toggle(platform)}
                    >
                        <PlatformLogo platform={platform} className="h-4 w-4" />
                        {PLATFORM_LABEL[platform]}
                    </Row>
                ))}
            </PopoverContent>
        </Popover>
    )
}
