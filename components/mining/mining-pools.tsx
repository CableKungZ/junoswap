'use client'

import { useMemo } from 'react'
import { useChainId } from 'wagmi'
import type { Address } from 'viem'
import { Gem, Loader2, Unplug } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { IncentiveCard } from './incentive-card'
import { useIncentives } from '@/hooks/useIncentives'
import { useEarnStore, useMiningSettings } from '@/store/earn-store'
import { getV3StakerAddress } from '@/lib/dex-config'
import type { IncentiveKey, Incentive } from '@/types/earn'

// Known incentive keys per chain - in production, this would come from a backend or subgraph
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

export function MiningPools() {
    const chainId = useChainId()
    const stakerAddress = getV3StakerAddress(chainId)
    const { openStakeDialog, setHideEndedIncentives } = useEarnStore()
    const miningSettings = useMiningSettings()
    const incentiveKeys = useMemo(() => KNOWN_INCENTIVES[chainId] ?? [], [chainId])
    const { incentives, isLoading } = useIncentives(incentiveKeys)
    const filteredIncentives = useMemo(() => {
        if (!miningSettings.hideEndedIncentives) return incentives
        return incentives.filter((i) => !i.isEnded)
    }, [incentives, miningSettings.hideEndedIncentives])
    const handleStake = (incentive: Incentive) => {
        openStakeDialog(incentive)
    }
    if (!stakerAddress) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <EmptyState
                        icon={Unplug}
                        title="Not available"
                        description="LP Mining is not available on this chain."
                        compact
                    />
                </CardContent>
            </Card>
        )
    }
    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <EmptyState
                        icon={Loader2}
                        title="Loading incentives"
                        compact
                        className="[&_svg]:animate-spin [&_svg]:text-muted-foreground"
                    />
                </CardContent>
            </Card>
        )
    }
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Mining Pools</h2>
                    <p className="text-sm text-muted-foreground">
                        Stake your LP positions to earn rewards
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="hide-ended"
                        checked={miningSettings.hideEndedIncentives}
                        onCheckedChange={setHideEndedIncentives}
                    />
                    <Label htmlFor="hide-ended" className="text-sm">
                        Hide ended
                    </Label>
                </div>
            </div>
            {filteredIncentives.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <EmptyState
                            icon={Gem}
                            title="No active mining incentives"
                            description="Check back later for new rewards programs."
                            compact
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredIncentives.map((incentive) => (
                        <IncentiveCard
                            key={incentive.incentiveId}
                            incentive={incentive}
                            onStake={handleStake}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
