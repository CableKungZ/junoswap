'use client'

import { cn } from '@/lib/utils'
import { calculateGraduationProgress, formatKub } from '@/services/launchpad'
import { Badge } from '@/components/ui/badge'

interface GraduationProgressProps {
    nativeReserve: bigint
    graduationAmount: bigint
    isGraduated: boolean
    className?: string
}

export function GraduationProgress({
    nativeReserve,
    graduationAmount,
    isGraduated,
    className,
}: GraduationProgressProps) {
    if (isGraduated) {
        return (
            <Badge variant="default" className="bg-green-600 text-white">
                Graduated
            </Badge>
        )
    }

    const progress = calculateGraduationProgress(nativeReserve, graduationAmount)

    return (
        <div className={cn('space-y-1', className)}>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <div className="text-xs text-muted-foreground">
                    {formatKub(nativeReserve)} / {formatKub(graduationAmount)} KUB
                </div>
                <span>{progress.toFixed(1)}%</span>
            </div>
        </div>
    )
}
