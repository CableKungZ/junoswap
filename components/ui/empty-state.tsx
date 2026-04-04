import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
    compact?: boolean
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    compact,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center gap-2',
                compact ? 'py-4' : 'py-6',
                className
            )}
        >
            <div className={cn('mb-3 rounded-full bg-primary/10', compact ? 'p-2' : 'p-4')}>
                <Icon className={cn('text-primary/50', compact ? 'h-6 w-6' : 'h-10 w-10')} />
            </div>
            <h3 className={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        'mt-1.5 max-w-xs text-muted-foreground',
                        compact ? 'text-xs' : 'text-sm'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
