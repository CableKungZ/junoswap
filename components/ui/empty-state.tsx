'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon?: React.ComponentType<{ className?: string }>
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
    compact?: boolean
    variant?: 'default' | 'subtle' | 'error'
    animated?: boolean
}

const glowColors = {
    default: 'radial-gradient(circle, hsl(0 100% 60% / 0.12) 0%, transparent 70%)',
    subtle: 'radial-gradient(circle, hsl(0 0% 50% / 0.06) 0%, transparent 70%)',
    error: 'radial-gradient(circle, hsl(0 84% 60% / 0.12) 0%, transparent 70%)',
}

const ringColors = {
    default: 'border-primary/15',
    subtle: 'border-muted-foreground/10',
    error: 'border-destructive/15',
}

const floatAnimation = {
    y: [0, -6, 0],
    transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut' as const,
    },
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    compact,
    variant = 'default',
    animated = true,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'gap-3 py-10 px-6' : 'gap-5 py-16 px-8',
                className
            )}
        >
            {Icon && (
                <div
                    className={cn(
                        'relative mx-auto flex items-center justify-center',
                        compact ? 'h-16 w-16' : 'h-24 w-24'
                    )}
                >
                    {/* Glow background */}
                    <div
                        className="empty-state-glow-pulse absolute inset-0 rounded-full"
                        style={{ background: glowColors[variant] }}
                    />

                    {/* Icon with float animation */}
                    <motion.div
                        animate={animated ? floatAnimation : undefined}
                        className="relative z-10"
                    >
                        <Icon
                            className={cn(
                                'shrink-0 text-primary',
                                compact ? 'h-7 w-7' : 'h-12 w-12'
                            )}
                        />
                    </motion.div>

                    {/* Decorative dashed ring */}
                    <div
                        className={cn(
                            'absolute -inset-2 rounded-full border border-dashed',
                            ringColors[variant]
                        )}
                    />
                </div>
            )}
            <h3
                className={cn(
                    'font-semibold tracking-tight',
                    compact
                        ? 'text-base text-foreground'
                        : 'text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'
                )}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        'leading-relaxed text-muted-foreground',
                        compact ? 'max-w-xs text-sm' : 'max-w-md text-sm'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className={compact ? 'mt-2' : 'mt-3'}>{action}</div>}
        </div>
    )
}
