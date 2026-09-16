import { cn } from '@/lib/utils'
import type { LaunchpadPlatform } from '@/types/launchpad'

export function PlatformLogo({
    platform,
    className,
}: {
    platform: LaunchpadPlatform
    className?: string
}) {
    return (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, next/image adds nothing
        <img
            src={`/platforms/${platform}.svg`}
            alt=""
            aria-hidden="true"
            className={cn('h-3 w-3 shrink-0 rounded-full object-contain', className)}
        />
    )
}
