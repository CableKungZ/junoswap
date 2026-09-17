'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sprout } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TokenIcon } from '@/components/ui/token-icon'
import { formatAddress, formatTimeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/services/launchpad/launchpad'
import { splitSparklineByDirection } from '@/services/launchpad/chart'
import type { LaunchToken } from '@/types/launchpad'
import { useNativeUsdPriceContext } from './native-usd-price-provider'
import { AthProgressBar } from './ath-progress-bar'
import { PlatformLogo } from './platform-logo'
import { DurianfunMcap } from './durianfun-mcap'

// Meme-style "stonks" line in the corner of the token icon, traced from real recent price
// samples (sparklinePath, from useGraduatedTokenActivity / useCurveTokenSparklines). A fixed jagged
// path stands in only while that query is loading or failed.
// Both span the same 4..100 x / 12..100 y box buildSparklinePath emits, so the two read alike.
const CHART_OVERLAY_PATH_UP = 'M4,100 L20,86 L32,94 L46,62 L58,70 L72,34 L84,42 L100,12'
const CHART_OVERLAY_PATH_DOWN = 'M4,12 L20,26 L32,18 L46,50 L58,42 L72,76 L84,68 L100,100'

function ChartOverlay({ isUp, path }: { isUp: boolean; path?: string | null }) {
    const d = path || (isUp ? CHART_OVERLAY_PATH_UP : CHART_OVERLAY_PATH_DOWN)
    return (
        <svg
            // Stretched (preserveAspectRatio="none") over the path's 4..100 x / 12..100 y extents;
            // non-scaling-stroke keeps the line width steady. overflow-visible so the stroke and
            // glow at the peaks aren't clipped. With no backdrop, a dark halo stroke underneath
            // keeps the line legible over busy logos.
            viewBox="4 12 96 88"
            preserveAspectRatio="none"
            overflow="visible"
            className="pointer-events-none absolute bottom-2 right-2 h-[30%] w-[44%]"
            aria-hidden="true"
        >
            <path
                d={d}
                fill="none"
                stroke="rgb(0 0 0 / 0.55)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
            {splitSparklineByDirection(d).map((run, i) => (
                <path
                    key={i}
                    d={run.d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className={run.isUp ? 'text-positive' : 'text-negative'}
                    style={{ filter: 'drop-shadow(0 0 3px)' }}
                />
            ))}
        </svg>
    )
}

const RECENT_TRADE_SECONDS = 120

interface TokenCardProps {
    token: LaunchToken
    tokenName?: string
    tokenSymbol?: string
    marketCap?: string
    athMarketCap?: string
    isGraduated?: boolean
    lastSwapAt?: number
    priceChange1dPct?: number | null
    sparklinePath?: string | null
}

export function TokenCard({
    token,
    tokenName,
    tokenSymbol,
    marketCap,
    athMarketCap,
    isGraduated,
    lastSwapAt = 0,
    priceChange1dPct,
    sparklinePath,
}: TokenCardProps) {
    // Play the push-in animation when a background refetch brings a newer trade. Graduated tokens
    // first render the indexer snapshot's (often stale) lastSwapAt before live activity loads, so a
    // bump only counts if the trade itself is recent -- otherwise that swap-in animates on page load.
    const [seenSwapAt, setSeenSwapAt] = useState(lastSwapAt)
    const [isPushedIn, setIsPushedIn] = useState(false)
    if (lastSwapAt !== seenSwapAt) {
        setSeenSwapAt(lastSwapAt)
        if (lastSwapAt > seenSwapAt && Date.now() / 1000 - lastSwapAt < RECENT_TRADE_SECONDS) {
            setIsPushedIn(true)
        }
    }

    const { nativeUsdPrice } = useNativeUsdPriceContext()
    const symbol = tokenSymbol || token.symbol || '???'
    const name = tokenName || token.name || ''
    const isJunoswap = !token.platform || token.platform === 'junoswap'
    const hasAth = !!athMarketCap && parseFloat(athMarketCap) > 0
    const athNum = athMarketCap ? parseFloat(athMarketCap) : undefined
    const isDurianfun = token.platform === 'durianfun'

    const formatMarketCap = (value: string) =>
        nativeUsdPrice !== null
            ? `$${formatCompact(parseFloat(value) * nativeUsdPrice, 2)}`
            : `${formatCompact(parseFloat(value), 2)} KUB`

    return (
        <Link
            href={`/launchpad/token/${token.address}?chain=${token.chainId}`}
            className={cn('group relative block h-full', isPushedIn && 'animate-card-push-in')}
            onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setIsPushedIn(false)
            }}
        >
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-primary to-[#FF914D] opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-40" />
            <Card className="relative h-full overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
                <CardContent className="flex h-full flex-col p-0">
                    <div className="relative aspect-square w-full">
                        <TokenIcon
                            src={token.logo}
                            symbol={symbol}
                            size="2xl"
                            variant="square"
                            className="h-full w-full rounded-b-none"
                        />
                        {(sparklinePath || priceChange1dPct != null) && (
                            <ChartOverlay
                                isUp={(priceChange1dPct ?? 0) >= 0}
                                path={sparklinePath}
                            />
                        )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col p-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-base font-semibold tracking-tight">
                                {symbol}
                            </span>
                            {priceChange1dPct != null && (
                                <span
                                    className={cn(
                                        'shrink-0 text-xs font-medium tabular-nums',
                                        priceChange1dPct >= 0 ? 'text-positive' : 'text-negative'
                                    )}
                                >
                                    {priceChange1dPct >= 0 ? '+' : ''}
                                    {priceChange1dPct.toFixed(2)}%
                                </span>
                            )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{name || ' '}</p>
                        {!isJunoswap && token.description && (
                            <p
                                className="truncate text-xs text-muted-foreground/80"
                                title={token.description}
                            >
                                {token.description}
                            </p>
                        )}
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="truncate">{formatAddress(token.creator)}</span>
                            <Sprout className="h-3 w-3 shrink-0" />
                            <span className="shrink-0">
                                {formatTimeAgo(token.createdTime).replace(' ago', '')}
                            </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {token.platform === 'durianfun' ? (
                                    <>
                                        <PlatformLogo platform="durianfun" />
                                        DurianFun
                                    </>
                                ) : (
                                    <>
                                        <PlatformLogo platform="junoswap" />
                                        Junoswap
                                    </>
                                )}
                            </span>
                            {isGraduated && (
                                <span className="shrink-0 rounded-full border border-positive/25 bg-positive/10 px-2 py-0.5 text-[10px] font-medium text-positive">
                                    Graduated
                                </span>
                            )}
                        </div>

                        <div className="mt-auto pt-3">
                            <div className="flex justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                        Mcap
                                    </p>
                                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                                        <span className="whitespace-nowrap">
                                            {marketCap ? formatMarketCap(marketCap) : '—'}
                                        </span>
                                        {isDurianfun && marketCap && (
                                            <DurianfunMcap
                                                marketCap={parseFloat(marketCap)}
                                                athMarketCap={athNum}
                                                label={false}
                                                className="ml-1.5 inline-block text-[11px] font-normal tracking-normal"
                                            />
                                        )}
                                    </p>
                                </div>
                                {hasAth && (
                                    <div className="flex shrink-0 flex-col items-end text-[11px] tabular-nums text-muted-foreground">
                                        <p>ATH {formatMarketCap(athMarketCap)}</p>
                                        {isDurianfun && (
                                            <DurianfunMcap
                                                marketCap={marketCap ? parseFloat(marketCap) : 0}
                                                athMarketCap={athNum}
                                                show="ath"
                                                label={false}
                                                className="text-[11px] leading-tight"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                            {hasAth && marketCap && (
                                <div className="mt-2">
                                    <AthProgressBar
                                        marketCap={parseFloat(marketCap)}
                                        athMarketCap={parseFloat(athMarketCap)}
                                        className="h-1"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
