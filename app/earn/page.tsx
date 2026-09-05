'use client'

import { Suspense, useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Info } from 'lucide-react'
import { useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PoolsList } from '@/components/positions/pools'
import { AddLiquidityDialog } from '@/components/positions/add-liquidity-dialog'
import {
    CreateFarmDialog,
    FarmUnstakeDialog,
    MiningFarms,
    MyFarms,
    MyPositions,
    StakeDialog,
    UnstakeDialog,
} from '@/components/mining'
import { CreateEarnProgramDialog } from '@/components/earn/create-earn-program-dialog'
import { CreateStakingPoolDialog } from '@/components/earn/create-staking-pool-dialog'
import { StakingPools } from '@/components/earn/staking-pools'
import { getAvailablePrograms, getStakingRewards, type EarnProgram } from '@/lib/earn-programs'
import { incentiveToPoolData } from '@/services/mining/incentives'
import type { Incentive, StakedPosition, V3PoolData } from '@/types/earn'

const TABS = [
    { value: 'liquidity', label: 'Liquidity' },
    { value: 'lp-farming', label: 'LP Farming' },
    { value: 'token-staking', label: 'Token Staking' },
] as const

type TabValue = (typeof TABS)[number]['value']

/** A tab whose contracts are not deployed on this chain is hidden, not shown empty. */
function availableTabs(chainId: number) {
    return TABS.filter((tab) => {
        if (tab.value === 'lp-farming') return getAvailablePrograms(chainId).length > 0
        if (tab.value === 'token-staking') return !!getStakingRewards(chainId)
        return true
    })
}

function EarnContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chainId = useChainId()
    const tabs = availableTabs(chainId)
    const tabParam = searchParams.get('tab')
    const tab: TabValue = tabs.some((t) => t.value === tabParam)
        ? (tabParam as TabValue)
        : 'liquidity'
    const [createProgram, setCreateProgram] = useState<EarnProgram>('v3')

    const [selectedIncentive, setSelectedIncentive] = useState<Incentive | null>(null)
    const [selectedStakedPosition, setSelectedStakedPosition] = useState<StakedPosition | null>(
        null
    )

    const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)
    const [addLiquidityPool, setAddLiquidityPool] = useState<V3PoolData | null>(null)
    const [isStakeDialogOpen, setIsStakeDialogOpen] = useState(false)
    const [isUnstakeDialogOpen, setIsUnstakeDialogOpen] = useState(false)
    const [isProgramPickerOpen, setIsProgramPickerOpen] = useState(false)
    const [isCreateFarmOpen, setIsCreateFarmOpen] = useState(false)
    const [isCreateStakingPoolOpen, setIsCreateStakingPoolOpen] = useState(false)
    const [unstakeFarm, setUnstakeFarm] = useState<Incentive | null>(null)
    const [isFarmUnstakeOpen, setIsFarmUnstakeOpen] = useState(false)

    const queryClient = useQueryClient()
    const bumpRefresh = useCallback(() => {
        queryClient.invalidateQueries()
    }, [queryClient])

    const openAddLiquidity = (pool?: V3PoolData) => {
        setAddLiquidityPool(pool ?? null)
        setIsAddLiquidityOpen(true)
    }
    const openStakeDialog = (incentive: Incentive) => {
        setSelectedIncentive(incentive)
        setIsStakeDialogOpen(true)
    }
    const openUnstakeDialog = (staked: StakedPosition) => {
        setSelectedStakedPosition(staked)
        setIsUnstakeDialogOpen(true)
    }
    const openFarmUnstakeDialog = (incentive: Incentive) => {
        setUnstakeFarm(incentive)
        setIsFarmUnstakeOpen(true)
    }
    const pickProgram = (id: EarnProgram | 'v2') => {
        setIsProgramPickerOpen(false)
        if (id === 'v2') {
            setIsCreateStakingPoolOpen(true)
            return
        }
        setCreateProgram(id)
        setIsCreateFarmOpen(true)
    }

    return (
        <div className="flex min-h-screen items-start justify-center p-4 pt-8">
            <div className="w-full max-w-5xl space-y-4">
                <Tabs
                    value={tab}
                    onValueChange={(next) => router.replace(`/earn?tab=${next}`, { scroll: false })}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-border/50">
                        <TabsList className="w-full justify-start gap-4">
                            {tabs.map((t) => (
                                <TabsTrigger
                                    key={t.value}
                                    value={t.value}
                                    className="rounded-none border-b-2 border-transparent px-1 pb-3 data-[state=active]:border-primary"
                                >
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Link
                            href="/learn/staking"
                            title="How the earn programs differ"
                            aria-label="How the earn programs differ"
                            className="mb-2 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Info className="h-4 w-4" />
                        </Link>
                    </div>

                    <TabsContent value="liquidity">
                        <PoolsList onAddLiquidity={openAddLiquidity} />
                    </TabsContent>

                    <TabsContent value="lp-farming" className="space-y-6">
                        <MiningFarms
                            onStake={openStakeDialog}
                            onUnstake={openFarmUnstakeDialog}
                            onAddLiquidity={(incentive) =>
                                openAddLiquidity(incentiveToPoolData(incentive))
                            }
                            onCreate={() => setIsProgramPickerOpen(true)}
                        />
                        <MyPositions onUnstake={openUnstakeDialog} />
                        <MyFarms />
                    </TabsContent>

                    <TabsContent value="token-staking">
                        <StakingPools onCreate={() => setIsProgramPickerOpen(true)} />
                    </TabsContent>
                </Tabs>

                <StakeDialog
                    open={isStakeDialogOpen}
                    incentive={selectedIncentive}
                    onClose={() => setIsStakeDialogOpen(false)}
                    onAddLiquidity={openAddLiquidity}
                    onSuccess={bumpRefresh}
                />
                <UnstakeDialog
                    open={isUnstakeDialogOpen}
                    stakedPosition={selectedStakedPosition}
                    onClose={() => setIsUnstakeDialogOpen(false)}
                    onSuccess={bumpRefresh}
                />
                <FarmUnstakeDialog
                    open={isFarmUnstakeOpen}
                    incentive={unstakeFarm}
                    onClose={() => setIsFarmUnstakeOpen(false)}
                    onSuccess={bumpRefresh}
                />
                <CreateFarmDialog
                    open={isCreateFarmOpen}
                    program={createProgram}
                    onClose={() => setIsCreateFarmOpen(false)}
                    onSuccess={bumpRefresh}
                />
                <AddLiquidityDialog
                    open={isAddLiquidityOpen}
                    initialPool={addLiquidityPool}
                    onClose={() => setIsAddLiquidityOpen(false)}
                    onSuccess={bumpRefresh}
                />
                <CreateEarnProgramDialog
                    open={isProgramPickerOpen}
                    onClose={() => setIsProgramPickerOpen(false)}
                    onSelect={pickProgram}
                />
                <CreateStakingPoolDialog
                    open={isCreateStakingPoolOpen}
                    onClose={() => setIsCreateStakingPoolOpen(false)}
                    onSuccess={bumpRefresh}
                />
            </div>
        </div>
    )
}

export default function EarnPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">Loading...</div>
            }
        >
            <EarnContent />
        </Suspense>
    )
}
