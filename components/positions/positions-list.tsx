'use client'

import { useMemo } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { Droplets } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { useUserPositions } from '@/hooks/useUserPositions'
import { useEarnStore, useEarnSettings } from '@/store/earn-store'
import { formatTokenAmount } from '@/services/tokens'
import type { PositionWithTokens } from '@/types/earn'

function PositionCard({ position }: { position: PositionWithTokens }) {
    const { openPositionDetails, openCollectFees, openRemoveLiquidity, openIncreaseLiquidity } =
        useEarnStore()
    const hasFees = position.tokensOwed0 > 0n || position.tokensOwed1 > 0n
    const isClosed = position.liquidity === 0n
    return (
        <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => openPositionDetails(position)}
        >
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage
                                    src={position.token0Info.logo}
                                    alt={position.token0Info.symbol}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {position.token0Info.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage
                                    src={position.token1Info.logo}
                                    alt={position.token1Info.symbol}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {position.token1Info.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div>
                            <div className="font-medium">
                                {position.token0Info.symbol} / {position.token1Info.symbol}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {(position.fee / 10000).toFixed(2)}% fee
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isClosed ? (
                            <Badge variant="secondary">Closed</Badge>
                        ) : position.inRange ? (
                            <Badge variant="default" className="bg-green-600">
                                In Range
                            </Badge>
                        ) : (
                            <Badge variant="secondary">Out of Range</Badge>
                        )}
                    </div>
                </div>
                {!isClosed && (
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">Pooled</div>
                            <div>
                                {formatTokenAmount(position.amount0, position.token0Info.decimals)}{' '}
                                {position.token0Info.symbol}
                            </div>
                            <div>
                                {formatTokenAmount(position.amount1, position.token1Info.decimals)}{' '}
                                {position.token1Info.symbol}
                            </div>
                        </div>
                        {hasFees && (
                            <div>
                                <div className="text-muted-foreground">Unclaimed Fees</div>
                                <div>
                                    {formatTokenAmount(
                                        position.tokensOwed0,
                                        position.token0Info.decimals
                                    )}{' '}
                                    {position.token0Info.symbol}
                                </div>
                                <div>
                                    {formatTokenAmount(
                                        position.tokensOwed1,
                                        position.token1Info.decimals
                                    )}{' '}
                                    {position.token1Info.symbol}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="mt-3 flex gap-2 justify-end">
                    {hasFees && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation()
                                openCollectFees(position)
                            }}
                        >
                            Collect
                        </Button>
                    )}
                    {!isClosed && (
                        <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                                e.stopPropagation()
                                openIncreaseLiquidity(position)
                            }}
                        >
                            Add
                        </Button>
                    )}
                    {!isClosed && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation()
                                openRemoveLiquidity(position)
                            }}
                        >
                            Remove
                        </Button>
                    )}
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

export function PositionsList() {
    const { address } = useAccount()
    const chainId = useChainId()
    const { positions, isLoading } = useUserPositions(address, chainId)
    const { openAddLiquidity } = useEarnStore()
    const settings = useEarnSettings()
    const filteredPositions = useMemo(() => {
        const result = settings.hideClosedPositions
            ? positions.filter((p) => p.liquidity > 0n)
            : positions
        result.sort((a, b) => {
            const getPriority = (p: PositionWithTokens) => {
                if (p.liquidity === 0n) return 2 // Closed
                return p.inRange ? 0 : 1 // In Range : Out of Range
            }
            const priorityA = getPriority(a)
            const priorityB = getPriority(b)
            return priorityA - priorityB
        })
        return result
    }, [positions, settings.hideClosedPositions])
    if (isLoading) {
        return <LoadingState />
    }
    if (filteredPositions.length === 0) {
        return (
            <Card>
                <CardContent className="py-12">
                    <EmptyState
                        icon={Droplets}
                        title="No liquidity positions"
                        description="You don't have any liquidity positions yet."
                        action={<Button onClick={() => openAddLiquidity()}>Create Position</Button>}
                    />
                </CardContent>
            </Card>
        )
    }
    return (
        <div className="space-y-3">
            {filteredPositions.map((position) => (
                <PositionCard key={position.tokenId.toString()} position={position} />
            ))}
        </div>
    )
}
