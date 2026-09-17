'use client'

import { cn } from '@/lib/utils'
import { formatCompact } from '@/services/launchpad/launchpad'
import { TOTAL_SUPPLY, DURIANFUN_MCAP_SUPPLY } from '@/lib/launchpad-curve'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useNativeUsdPriceContext } from './native-usd-price-provider'

const toDurianfunBase = (mcapNative: number) => (mcapNative / TOTAL_SUPPLY) * DURIANFUN_MCAP_SUPPLY

/** Side reference: a DurianFun token's mcap/ATH the way durianfun.xyz displays them. */
export function DurianfunMcap({
    marketCap,
    athMarketCap,
    show = 'mcap',
    label = true,
    className,
}: {
    marketCap: number
    athMarketCap?: number
    show?: 'mcap' | 'ath'
    label?: boolean
    className?: string
}) {
    const { nativeUsdPrice } = useNativeUsdPriceContext()
    const value = show === 'ath' ? (athMarketCap ?? 0) : marketCap
    if (!(value > 0)) return null

    const format = (native: number) =>
        nativeUsdPrice !== null
            ? `$${formatCompact(toDurianfunBase(native) * nativeUsdPrice, 2)}`
            : `${formatCompact(toDurianfunBase(native), 2)} KUB`

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={cn(
                        'cursor-help text-xs text-muted-foreground tabular-nums underline decoration-dotted underline-offset-2',
                        className
                    )}
                >
                    {label && 'DurianFun '}
                    {format(value)}
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-80 normal-case">
                <div className="font-medium">As shown on DurianFun (durianfun.xyz)</div>
                <div className="mt-1 space-y-0.5 tabular-nums">
                    {marketCap > 0 && <div>MCAP {format(marketCap)}</div>}
                    {athMarketCap != null && athMarketCap > 0 && (
                        <div>ATH {format(athMarketCap)}</div>
                    )}
                </div>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                    <div>DurianFun: price × 2,000,000,000 × KUB/USD</div>
                    <div>Junoswap: price × 1,000,000,000 × KUB/USD</div>
                    <div className="pt-1">
                        The token&apos;s on-chain totalSupply is 1B, so DurianFun&apos;s figures are
                        2× the real market cap.
                    </div>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
