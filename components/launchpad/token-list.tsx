'use client'

import { useMemo, useState } from 'react'
import { useTokenList } from '@/hooks/useTokenList'
import { useGraduatedTokenActivity } from '@/hooks/useGraduatedTokenActivity'
import { useCurveTokenSparklines } from '@/hooks/useCurveTokenSparklines'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import type { LaunchpadPlatform, LaunchpadSortKey } from '@/types/launchpad'
import { TokenCard } from './token-card'
import { SortTabs } from './sort-tabs'
import { ALL_PLATFORMS, PlatformFilter } from './platform-filter'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

interface TokenListProps {
    searchQuery?: string
}

export function TokenList({ searchQuery = '' }: TokenListProps) {
    const { tokens, snapshotMap, isLoading } = useTokenList()
    const [sortKey, setSortKey] = useState<LaunchpadSortKey>('last-trade')
    const [platforms, setPlatforms] = useState<LaunchpadPlatform[]>(ALL_PLATFORMS)
    const chainId = useLaunchpadChainId()

    const graduatedTokens = useMemo(
        () =>
            tokens
                .filter((t) => t.isGraduated)
                .map((t) => ({ address: t.address, graduatedAt: t.graduatedAt ?? null })),
        [tokens]
    )
    const { activity: liveActivity, isPending: activityPending } = useGraduatedTokenActivity(
        graduatedTokens,
        chainId
    )
    const curveTokenAddrs = useMemo(
        () => tokens.filter((t) => !t.isGraduated).map((t) => t.address),
        [tokens]
    )
    const { sparklines: curveSparklines, isPending: sparklinesPending } = useCurveTokenSparklines(
        curveTokenAddrs,
        chainId
    )

    // Hold the skeleton until every per-token query settles once per chain, so cards don't
    // reshuffle as live values replace snapshot ones. Later refetches/new tokens don't re-block.
    const [loadedChainId, setLoadedChainId] = useState<number | null>(null)
    if (loadedChainId !== chainId && !isLoading && !activityPending && !sparklinesPending) {
        setLoadedChainId(chainId)
    }

    const enrichedTokens = useMemo(() => {
        return tokens.map((token) => {
            const snapshot = snapshotMap.get(token.address.toLowerCase())
            const activity = liveActivity.get(token.address.toLowerCase())
            const liveMarketCap = activity?.marketCap
            const lastSwapAt = activity?.lastSwapAt ?? snapshot?.lastSwapAt ?? 0

            return {
                token,
                tokenName: token.name,
                tokenSymbol: token.symbol,
                isGraduated: !!token.isGraduated,
                lastSwapAt,
                marketCap:
                    liveMarketCap != null ? String(liveMarketCap) : snapshot?.marketCapNative,
                athMarketCap:
                    activity?.athMarketCap != null
                        ? String(activity.athMarketCap)
                        : snapshot?.athMarketCapNative,
                priceChange1dPct:
                    activity?.priceChange1dPct ?? snapshot?.priceChange1dPct ?? undefined,
                sparklinePath:
                    activity?.sparklinePath ??
                    curveSparklines.get(token.address.toLowerCase()) ??
                    null,
            }
        })
    }, [tokens, snapshotMap, liveActivity, curveSparklines])

    const filtered = useMemo(() => {
        const byPlatform = enrichedTokens.filter(({ token }) => {
            return platforms.includes(token.platform ?? 'junoswap')
        })
        if (!searchQuery.trim()) return byPlatform
        const q = searchQuery.toLowerCase().trim()
        return byPlatform.filter(({ token, tokenName, tokenSymbol }) => {
            const symbol = (tokenSymbol || token.symbol || '').toLowerCase()
            const name = (tokenName || token.name || '').toLowerCase()
            const addr = token.address.toLowerCase()
            const creator = token.creator.toLowerCase()
            return symbol.includes(q) || name.includes(q) || addr.includes(q) || creator.includes(q)
        })
    }, [enrichedTokens, searchQuery, platforms])

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            switch (sortKey) {
                case 'last-trade':
                    if (b.lastSwapAt !== a.lastSwapAt) return b.lastSwapAt - a.lastSwapAt
                    return b.token.createdTime - a.token.createdTime
                case 'market-cap': {
                    const aMc = parseFloat(a.marketCap ?? '0')
                    const bMc = parseFloat(b.marketCap ?? '0')
                    return bMc - aMc
                }
                case 'new':
                    return b.token.createdTime - a.token.createdTime
                case 'oldest':
                    return a.token.createdTime - b.token.createdTime
            }
        })
    }, [filtered, sortKey])

    if (isLoading || loadedChainId !== chainId) {
        return <TokenListSkeleton />
    }

    if (tokens.length === 0) {
        return (
            <EmptyState
                title="No tokens yet"
                description="Be the first to create a token on the launchpad!"
            />
        )
    }

    const toolbar = (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <PlatformFilter value={platforms} onChange={setPlatforms} />
            <SortTabs value={sortKey} onChange={setSortKey} />
        </div>
    )

    if (filtered.length === 0) {
        const description = searchQuery.trim()
            ? `No tokens matching "${searchQuery.trim()}"`
            : 'No tokens match this filter.'
        // The toolbar stays, or a platform filter that empties the list could not be undone.
        return (
            <div>
                {toolbar}
                <EmptyState title="No results" description={description} />
            </div>
        )
    }

    return (
        <div>
            {toolbar}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {sorted.map(
                    ({
                        token,
                        tokenName,
                        tokenSymbol,
                        isGraduated,
                        lastSwapAt,
                        marketCap,
                        athMarketCap,
                        priceChange1dPct,
                        sparklinePath,
                    }) => {
                        return (
                            <TokenCard
                                key={token.address}
                                token={token}
                                tokenName={tokenName}
                                tokenSymbol={tokenSymbol}
                                marketCap={marketCap}
                                athMarketCap={athMarketCap}
                                isGraduated={isGraduated}
                                lastSwapAt={lastSwapAt}
                                priceChange1dPct={priceChange1dPct}
                                sparklinePath={sparklinePath}
                            />
                        )
                    }
                )}
            </div>
        </div>
    )
}

function TokenListSkeleton() {
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-20 rounded-full bg-muted animate-pulse" />
                    ))}
                </div>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }, (_, i) => i).map((i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="aspect-square w-full animate-pulse bg-muted" />
                            <div className="space-y-1.5 p-3">
                                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                                <div className="h-1 w-full animate-pulse rounded-full bg-muted" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
