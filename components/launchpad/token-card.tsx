'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { formatAddress } from '@/lib/utils'
import type { LaunchToken } from '@/types/launchpad'
import { GraduationProgress } from './graduation-progress'

interface TokenCardProps {
    token: LaunchToken
    tokenName?: string
    tokenSymbol?: string
    nativeReserve?: bigint
    graduationAmount?: bigint
    marketCap?: string
    isGraduated?: boolean
}

export function TokenCard({
    token,
    tokenName,
    tokenSymbol,
    nativeReserve,
    graduationAmount,
    marketCap,
    isGraduated,
}: TokenCardProps) {
    const symbol = tokenSymbol || token.symbol || '???'
    const name = tokenName || token.name || ''

    return (
        <Link href={`/launchpad/token/${token.address}`}>
            <Card className="overflow-hidden transition-colors hover:border-primary/50 hover:bg-accent/50">
                <CardContent className="flex gap-4 p-4">
                    {/* Large coin image - left side */}
                    <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                        {token.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={token.logo}
                                alt={symbol}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    const el = e.target as HTMLImageElement
                                    el.style.display = 'none'
                                    const parent = el.parentElement
                                    if (parent && !parent.querySelector('span')) {
                                        const fallback = document.createElement('span')
                                        fallback.className =
                                            'text-3xl font-black text-muted-foreground/50'
                                        fallback.textContent = symbol.slice(0, 3)
                                        parent.appendChild(fallback)
                                    }
                                }}
                            />
                        ) : (
                            <span className="text-3xl font-black text-muted-foreground/50">
                                {symbol.slice(0, 3)}
                            </span>
                        )}
                    </div>

                    {/* Info - right side */}
                    <div className="min-w-0 flex-1 py-0.5">
                        <p className="truncate text-lg font-bold leading-tight">
                            {symbol}
                            {name && (
                                <span className="ml-1.5 font-normal text-muted-foreground">
                                    {name}
                                </span>
                            )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            by {formatAddress(token.creator)}
                        </p>

                        {/* Market data */}
                        {nativeReserve !== undefined && graduationAmount !== undefined && (
                            <div className="mt-3">
                                {marketCap && (
                                    <div className="mb-1.5 flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">MC</span>
                                        <span className="font-medium">{marketCap} KUB</span>
                                    </div>
                                )}
                                <GraduationProgress
                                    nativeReserve={nativeReserve}
                                    graduationAmount={graduationAmount}
                                    isGraduated={isGraduated ?? false}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
