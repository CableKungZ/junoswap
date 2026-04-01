'use client'

import { useMemo } from 'react'
import { useChainId } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { TOKEN_LISTS } from '@/lib/tokens'
import { usePoolsForPair } from '@/hooks/usePools'
import { useEarnStore } from '@/store/earn-store'
import { formatFeeTier } from '@/lib/liquidity-helpers'
import type { V3PoolData } from '@/types/earn'
import type { Token } from '@/types/tokens'

function PoolCard({ pool }: { pool: V3PoolData }) {
    const { openAddLiquidity } = useEarnStore()
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage src={pool.token0.logo} alt={pool.token0.symbol} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {pool.token0.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage src={pool.token1.logo} alt={pool.token1.symbol} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {pool.token1.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div>
                            <div className="font-medium">
                                {pool.token0.symbol} / {pool.token1.symbol}
                            </div>
                            <Badge variant="outline" className="mt-1">
                                {formatFeeTier(pool.fee)}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* TVL placeholder - would need subgraph data */}
                        <div className="text-right text-sm">
                            <div className="text-muted-foreground">Liquidity</div>
                            <div>{pool.liquidity > 0n ? 'Active' : 'Empty'}</div>
                        </div>
                        <Button size="sm" onClick={() => openAddLiquidity(pool)}>
                            Add
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function LoadingState() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <Card key={i}>
                    <CardContent className="p-4">
                        <div className="animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-muted" />
                                    <div className="w-8 h-8 rounded-full bg-muted" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-24 bg-muted rounded" />
                                    <div className="h-3 w-16 bg-muted rounded" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function EmptyState() {
    return (
        <Card>
            <CardContent className="py-12 text-center">
                <div className="text-muted-foreground">No pools available on this chain.</div>
            </CardContent>
        </Card>
    )
}

function useCommonPools(chainId: number): { pools: V3PoolData[]; isLoading: boolean } {
    const tokens = TOKEN_LISTS[chainId] ?? []
    // Get first 6 tokens to check pools (always use fixed number for stable hook count)
    const t0 = tokens[0] as Token | null
    const t1 = tokens[1] as Token | null
    const t2 = tokens[2] as Token | null
    const t3 = tokens[3] as Token | null
    const t4 = tokens[4] as Token | null
    const t5 = tokens[5] as Token | null

    // Call constant number of hooks (15 pairs for 6 tokens)
    const p01 = usePoolsForPair(t0, t1, chainId)
    const p02 = usePoolsForPair(t0, t2, chainId)
    const p03 = usePoolsForPair(t0, t3, chainId)
    const p04 = usePoolsForPair(t0, t4, chainId)
    const p05 = usePoolsForPair(t0, t5, chainId)
    const p12 = usePoolsForPair(t1, t2, chainId)
    const p13 = usePoolsForPair(t1, t3, chainId)
    const p14 = usePoolsForPair(t1, t4, chainId)
    const p15 = usePoolsForPair(t1, t5, chainId)
    const p23 = usePoolsForPair(t2, t3, chainId)
    const p24 = usePoolsForPair(t2, t4, chainId)
    const p25 = usePoolsForPair(t2, t5, chainId)
    const p34 = usePoolsForPair(t3, t4, chainId)
    const p35 = usePoolsForPair(t3, t5, chainId)
    const p45 = usePoolsForPair(t4, t5, chainId)

    const poolResults = useMemo(
        () => [p01, p02, p03, p04, p05, p12, p13, p14, p15, p23, p24, p25, p34, p35, p45],
        [p01, p02, p03, p04, p05, p12, p13, p14, p15, p23, p24, p25, p34, p35, p45]
    )

    const allPools = useMemo(() => {
        const combined = poolResults.flatMap((r) => r.pools)
        const unique = new Map<string, V3PoolData>()
        combined.forEach((pool) => {
            unique.set(pool.address, pool)
        })
        return Array.from(unique.values())
    }, [poolResults])
    const isLoading = poolResults.some((r) => r.isLoading)
    return {
        pools: allPools,
        isLoading,
    }
}

export function PoolsList() {
    const chainId = useChainId()
    const { pools, isLoading } = useCommonPools(chainId)
    if (isLoading) {
        return <LoadingState />
    }
    if (pools.length === 0) {
        return <EmptyState />
    }
    return (
        <div className="space-y-3">
            {pools.map((pool) => (
                <PoolCard key={pool.address} pool={pool} />
            ))}
        </div>
    )
}
