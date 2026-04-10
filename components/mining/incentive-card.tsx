'use client'

import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Copy } from 'lucide-react'
import { formatAddress } from '@/lib/utils'
import { toastSuccess } from '@/lib/toast'
import { ConnectModal } from '@/components/web3/connect-modal'
import type { Incentive } from '@/types/earn'
import { formatTokenAmount } from '@/services/tokens'
import {
    formatTimeRemaining,
    getIncentiveProgress,
    getIncentiveStatus,
} from '@/services/mining/incentives'

interface IncentiveCardProps {
    incentive: Incentive
    onStake: (incentive: Incentive) => void
}

export function IncentiveCard({ incentive, onStake }: IncentiveCardProps) {
    const { isConnected } = useAccount()
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
    const status = getIncentiveStatus(incentive)
    const progress = getIncentiveProgress(incentive.startTime, incentive.endTime)
    const timeRemaining = formatTimeRemaining(incentive.endTime)
    const statusColor = useMemo(() => {
        switch (status) {
            case 'active':
                return 'bg-green-500/10 text-green-500 border-green-500/20'
            case 'pending':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            case 'ended':
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
        }
    }, [status])
    const handleCopyAddress = (e: React.MouseEvent, address: string) => {
        e.stopPropagation()
        navigator.clipboard.writeText(address)
        toastSuccess('Address copied')
    }
    const formattedReward = formatTokenAmount(
        incentive.totalRewardUnclaimed,
        incentive.rewardTokenInfo.decimals
    )
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage
                                    src={incentive.poolToken0.logo}
                                    alt={incentive.poolToken0.symbol}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {incentive.poolToken0.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-background">
                                <AvatarImage
                                    src={incentive.poolToken1.logo}
                                    alt={incentive.poolToken1.symbol}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {incentive.poolToken1.symbol.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <CardTitle className="text-base font-medium">
                            {incentive.poolToken0.symbol} / {incentive.poolToken1.symbol}
                        </CardTitle>
                    </div>
                    <Badge variant="outline" className={statusColor}>
                        {status === 'active'
                            ? 'Active'
                            : status === 'pending'
                              ? 'Upcoming'
                              : 'Ended'}
                    </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                    {(incentive.poolFee / 10000).toFixed(2)}% fee tier
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground">Reward Token</div>
                        <div className="font-medium flex items-center flex-wrap gap-1">
                            <span>{incentive.rewardTokenInfo.name}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                                {formatAddress(incentive.rewardTokenInfo.address)}
                            </span>
                            <button
                                onClick={(e) =>
                                    handleCopyAddress(e, incentive.rewardTokenInfo.address)
                                }
                                className="hover:text-foreground text-muted-foreground"
                            >
                                <Copy className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Remaining Rewards</div>
                        <div className="font-medium">
                            {formattedReward} {incentive.rewardTokenInfo.symbol}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Stakers</div>
                        <div className="font-medium">{incentive.numberOfStakes}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Time</div>
                        <div className="font-medium">{timeRemaining}</div>
                    </div>
                </div>
                {status === 'active' && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
                <Button
                    onClick={() => {
                        if (!isConnected) {
                            setIsConnectModalOpen(true)
                            return
                        }
                        onStake(incentive)
                    }}
                    disabled={status === 'ended'}
                    className="w-full"
                    variant={status === 'active' ? 'default' : 'secondary'}
                >
                    {!isConnected
                        ? 'Connect Wallet'
                        : status === 'active'
                          ? 'Stake'
                          : status === 'pending'
                            ? 'Coming Soon'
                            : 'Ended'}
                </Button>
                <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
            </CardContent>
        </Card>
    )
}
