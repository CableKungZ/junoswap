'use client'

import { useMemo } from 'react'
import { useAccount, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { Coins, Loader2, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { StakedPosition, IncentiveKey } from '@/types/earn'
import { usePositionsByTokenIds } from '@/hooks/useUserPositions'
import { useIncentives } from '@/hooks/useIncentives'
import { useStakedPositions } from '@/hooks/useStakedPositions'
import { usePendingRewardsMultiple } from '@/hooks/useRewards'
import { useDepositedTokenIds } from '@/hooks/useDepositedTokenIds'
import { useEarnStore } from '@/store/earn-store'
import { formatTokenAmount } from '@/services/tokens'
import { formatTimeRemaining } from '@/services/mining/incentives'
import { getV3StakerAddress } from '@/lib/dex-config'

const KNOWN_INCENTIVES: Record<number, IncentiveKey[]> = {
    25925: [
        // KUB Testnet
        {
            rewardToken: '0x23352915164527e0AB53Ca5519aec5188aa224A2' as Address,
            pool: '0x81182579f4271B910bF108913Be78F0D9C44AaBa' as Address,
            startTime: 1764152820,
            endTime: 1795688820,
            refundee: '0xCA811301C650C92fD45ed32A81C0B757C61595b6' as Address,
        },
    ],
    8899: [], // JBC
    96: [
        // KUB Mainnet
        {
            rewardToken: '0xbB2d2523cF7737Bc9a1884aC2cC1C690Dd8f6D3e' as Address,
            pool: '0xcf0C912a4Efa1b12Eab70f3Ae701d6219103dF0F' as Address,
            startTime: 1765555920,
            endTime: 1766160720,
            refundee: '0x372719aF636C3a8f3819038b782f032436296993' as Address,
        },
    ],
}

export function StakedPositions() {
    const { address } = useAccount()
    const chainId = useChainId()
    const stakerAddress = getV3StakerAddress(chainId)
    const { openUnstakeDialog } = useEarnStore()
    const { tokenIds, isLoading: isLoadingTokenIds } = useDepositedTokenIds(address)
    const { positions: depositedPositions, isLoading: isLoadingPositions } = usePositionsByTokenIds(
        tokenIds,
        chainId
    )
    const incentiveKeys = useMemo(() => KNOWN_INCENTIVES[chainId] ?? [], [chainId])
    const { incentives, isLoading: isLoadingIncentives } = useIncentives(incentiveKeys)
    const { stakedPositions, isLoading: isLoadingStaked } = useStakedPositions(
        depositedPositions,
        incentives,
        address
    )
    const { rewards: rewardsMap, isLoading: isLoadingRewards } =
        usePendingRewardsMultiple(stakedPositions)
    const enrichedPositions = useMemo(() => {
        return stakedPositions.map((sp) => {
            const key = `${sp.tokenId.toString()}-${sp.incentiveId}`
            return {
                ...sp,
                pendingRewards: rewardsMap.get(key) ?? 0n,
            }
        })
    }, [stakedPositions, rewardsMap])
    const handleUnstake = (stakedPosition: StakedPosition) => {
        openUnstakeDialog(stakedPosition)
    }
    if (!stakerAddress) {
        return null
    }
    if (!address) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <EmptyState
                        icon={Wallet}
                        title="Connect wallet"
                        description="Connect your wallet to view staked positions."
                        compact
                    />
                </CardContent>
            </Card>
        )
    }
    const isLoading =
        isLoadingTokenIds ||
        isLoadingPositions ||
        isLoadingIncentives ||
        isLoadingStaked ||
        isLoadingRewards
    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <EmptyState
                        icon={Loader2}
                        title="Loading"
                        description="Loading staked positions..."
                        compact
                        className="[&_svg]:animate-spin [&_svg]:text-muted-foreground"
                    />
                </CardContent>
            </Card>
        )
    }
    if (enrichedPositions.length === 0) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">My Staked Positions</h2>
                <Card>
                    <CardContent className="pt-6">
                        <EmptyState
                            icon={Coins}
                            title="No staked positions"
                            description="Stake your LP positions in a mining pool to earn rewards."
                            compact
                        />
                    </CardContent>
                </Card>
            </div>
        )
    }
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">My Staked Positions</h2>
                <p className="text-sm text-muted-foreground">
                    {enrichedPositions.length} staked position
                    {enrichedPositions.length !== 1 ? 's' : ''}
                </p>
            </div>
            <div className="space-y-3">
                {enrichedPositions.map((sp) => (
                    <StakedPositionCard
                        key={`${sp.tokenId.toString()}-${sp.incentiveId}`}
                        stakedPosition={sp}
                        onUnstake={handleUnstake}
                    />
                ))}
            </div>
        </div>
    )
}

interface StakedPositionCardProps {
    stakedPosition: StakedPosition
    onUnstake: (stakedPosition: StakedPosition) => void
}

function StakedPositionCard({ stakedPosition, onUnstake }: StakedPositionCardProps) {
    const { position, incentive, pendingRewards } = stakedPosition
    const timeRemaining = formatTimeRemaining(incentive.endTime)
    const formattedRewards = formatTokenAmount(pendingRewards, incentive.rewardTokenInfo.decimals)
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">
                                {position.token0Info.symbol} / {position.token1Info.symbol}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                #{position.tokenId.toString()}
                            </Badge>
                            {incentive.isActive ? (
                                <Badge
                                    variant="outline"
                                    className="bg-green-500/10 text-green-500 border-green-500/20"
                                >
                                    Active
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    Ended
                                </Badge>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                            Reward: {incentive.rewardTokenInfo.symbol} &middot; {timeRemaining}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">Pending Rewards</div>
                        <div className="font-bold text-lg">
                            {formattedRewards} {incentive.rewardTokenInfo.symbol}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onUnstake(stakedPosition)}>
                        Unstake
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
