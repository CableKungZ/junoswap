'use client'

import { EARN_PROGRAM_BADGE, getAvailablePrograms, type EarnProgram } from '@/lib/earn-programs'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { TokenIconSkeleton } from '@/components/ui/token-icon'
import { ConnectModal } from '@/components/web3/connect-modal'
import { MiningFarmCard } from './farm-card'
import { FarmListToolbar, FarmSelectMenu } from './farm-list-toolbar'
import { FarmTable } from './farm-table'
import { useIncentives } from '@/hooks/useIncentives'
import { useIncentiveRewardValues } from '@/hooks/useIncentiveRewardValues'
import { useFarmOwnership } from '@/hooks/useFarmOwnership'
import { useFarmStats } from '@/hooks/useFarmStats'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import {
    DEFAULT_FARM_SORT,
    DEFAULT_FARM_VIEW,
    FARM_OWNERSHIP_OPTIONS,
    FARM_PAGE_SIZE,
    FARM_STATUS_OPTIONS,
    clampPage,
    filterFarms,
    getTotalPages,
    paginate,
    sortFarms,
} from '@/services/mining/farm-list'
import type {
    FarmOwnershipFilter,
    FarmSortKey,
    FarmStatusFilter,
    FarmView,
    Incentive,
} from '@/types/earn'

function FarmCardSkeleton() {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="animate-pulse space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                <TokenIconSkeleton size="md" />
                                <TokenIconSkeleton size="md" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-4 w-28 bg-muted rounded" />
                                <div className="h-3 w-20 bg-muted rounded" />
                            </div>
                        </div>
                        <div className="h-5 w-16 bg-muted rounded-full" />
                    </div>
                    <div className="h-[1px] bg-muted" />
                    <div className="grid grid-cols-2 gap-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 w-16 bg-muted rounded" />
                                <div className="h-5 w-20 bg-muted rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="h-9 w-full bg-muted rounded-xl" />
                </div>
            </CardContent>
        </Card>
    )
}

const EMPTY_FILTER_COPY: Record<FarmOwnershipFilter, { title: string; description: string }> = {
    all: {
        title: 'Nothing here right now',
        description: 'No farms match this filter.',
    },
    'my-staked': {
        title: 'No staked farms',
        description: 'Farms you have an LP position staked in will show up here.',
    },
    'match-my-position': {
        title: 'No matching farms',
        description: 'None of the pools you provide liquidity to are being rewarded right now.',
    },
}

export function MiningFarms({
    onStake,
    onUnstake,
    onAddLiquidity,
    onCreate,
}: {
    onStake: (incentive: Incentive) => void
    onUnstake: (incentive: Incentive) => void
    onAddLiquidity: (incentive: Incentive) => void
    onCreate: () => void
}) {
    const chainId = useChainId()
    const { isConnected } = useAccount()
    const availablePrograms = getAvailablePrograms(chainId)
    const hasStaker = availablePrograms.length > 0
    const programOptions: readonly { key: EarnProgram | 'all'; label: string }[] = [
        { key: 'all', label: 'All Rewards' },
        ...availablePrograms.map((program) => ({
            key: program,
            label: EARN_PROGRAM_BADGE[program].label,
        })),
    ]
    const now = useNowSeconds()

    const { incentives, isLoading } = useIncentives()
    const { valueByIncentiveId } = useIncentiveRewardValues(incentives)
    const { statsByIncentiveId } = useFarmStats(incentives, valueByIncentiveId)

    const [view, setView] = useState<FarmView>(DEFAULT_FARM_VIEW)
    const [sort, setSort] = useState<FarmSortKey>(DEFAULT_FARM_SORT)
    const [status, setStatus] = useState<FarmStatusFilter>('all')
    const [ownership, setOwnership] = useState<FarmOwnershipFilter>('all')
    const [programFilter, setProgramFilter] = useState<EarnProgram | 'all'>('all')
    const [page, setPage] = useState(1)
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)

    const {
        stakedIncentiveIds,
        myPoolAddresses,
        isLoading: isLoadingOwnership,
    } = useFarmOwnership(incentives, ownership)

    useEffect(() => {
        setPage(1)
    }, [view, sort, status, ownership, programFilter])

    const byProgram = useMemo(
        () =>
            programFilter === 'all'
                ? incentives
                : incentives.filter((i) => i.program === programFilter),
        [incentives, programFilter]
    )

    const visible = useMemo(() => {
        const ctx = {
            now,
            rewardValueUsd: valueByIncentiveId,
            stakedIncentiveIds,
            myPoolAddresses,
        }
        return sortFarms(filterFarms(byProgram, { status, ownership }, ctx), sort, ctx)
    }, [
        byProgram,
        status,
        ownership,
        sort,
        now,
        valueByIncentiveId,
        stakedIncentiveIds,
        myPoolAddresses,
    ])

    const pageSize = FARM_PAGE_SIZE[view]
    const totalPages = getTotalPages(visible.length, pageSize)
    const safePage = clampPage(page, totalPages)
    const pageItems = paginate(visible, safePage, pageSize)

    const createButton = (
        <Button
            variant="outline"
            onClick={() => {
                if (!isConnected) {
                    setIsConnectModalOpen(true)
                    return
                }
                onCreate()
            }}
        >
            <Plus />
            Create Program
        </Button>
    )

    if (!hasStaker) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold sm:text-xl">Mining Farms</h2>
                <EmptyState
                    title="Not available"
                    description="LP Mining is not available on this chain."
                />
            </div>
        )
    }

    const isBusy = isLoading || isLoadingOwnership
    const rangeStart = (safePage - 1) * pageSize + 1
    const rangeEnd = rangeStart + pageItems.length - 1

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-lg font-semibold sm:text-xl">Mining Farms</h2>
                <FarmListToolbar
                    sort={sort}
                    onSortChange={setSort}
                    view={view}
                    onViewChange={setView}
                    filters={
                        <>
                            {programOptions.length > 2 && (
                                <FarmSelectMenu
                                    value={programFilter}
                                    options={programOptions}
                                    onChange={setProgramFilter}
                                    ariaLabel="Filter by reward model"
                                />
                            )}
                            <FarmSelectMenu
                                value={status}
                                options={FARM_STATUS_OPTIONS}
                                onChange={setStatus}
                                ariaLabel="Filter by status"
                            />
                            {isConnected && (
                                <FarmSelectMenu
                                    value={ownership}
                                    options={FARM_OWNERSHIP_OPTIONS}
                                    onChange={setOwnership}
                                    ariaLabel="Filter farms"
                                />
                            )}
                        </>
                    }
                >
                    {createButton}
                </FarmListToolbar>
            </div>

            {isBusy ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <FarmCardSkeleton key={i} />
                    ))}
                </div>
            ) : incentives.length === 0 ? (
                <EmptyState
                    title="No mining farms yet"
                    description="Reward liquidity providers in any pool by funding the first farm."
                    action={createButton}
                />
            ) : visible.length === 0 ? (
                <EmptyState {...EMPTY_FILTER_COPY[ownership]} />
            ) : (
                <div className="space-y-4">
                    {view === 'card' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pageItems.map((incentive) => (
                                <MiningFarmCard
                                    key={incentive.incentiveId}
                                    incentive={incentive}
                                    stats={statsByIncentiveId[incentive.incentiveId]}
                                    onStake={onStake}
                                    onUnstake={onUnstake}
                                    onAddLiquidity={onAddLiquidity}
                                />
                            ))}
                        </div>
                    ) : (
                        <FarmTable
                            incentives={pageItems}
                            rewardValueUsd={valueByIncentiveId}
                            statsByIncentiveId={statsByIncentiveId}
                            now={now}
                            onStake={onStake}
                            onUnstake={onUnstake}
                            onAddLiquidity={onAddLiquidity}
                            onConnect={() => setIsConnectModalOpen(true)}
                        />
                    )}
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                            Showing {rangeStart}–{rangeEnd} of {visible.length}
                        </p>
                        <PaginationControls
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                </div>
            )}
            <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
        </div>
    )
}
