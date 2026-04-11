import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon?: React.ComponentType<{ className?: string }>
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
                'flex flex-col items-center justify-center text-center',
                compact ? 'gap-2 p-6' : 'gap-4 p-10',
                className
            )}
        >
            {Icon && (
                <div
                    className={cn(
                        'flex items-center justify-center',
                        compact ? 'mb-1 h-12 w-12' : 'mb-2 h-16 w-16'
                    )}
                >
                    <Icon
                        className={cn('text-primary shrink-0', compact ? 'h-5 w-5' : 'h-16 w-16')}
                    />
                </div>
            )}
            <h3
                className={cn(
                    'font-semibold tracking-tight text-foreground',
                    compact ? 'text-sm' : 'text-base'
                )}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        'max-w-xs leading-relaxed text-muted-foreground',
                        compact ? 'text-xs' : 'text-sm'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className={compact ? 'mt-2' : 'mt-3'}>{action}</div>}
        </div>
    )
}
