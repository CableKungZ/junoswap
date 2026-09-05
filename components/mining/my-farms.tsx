'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { FarmIdentity, FarmStatusBadge, ProgramMark } from './farm-status-badge'
import { FarmListToolbar, FarmSelectMenu } from './farm-list-toolbar'
import { MyFarmTable } from './farm-table'
import { EndFarmButton } from './end-farm-button'
import { useMyIncentives } from '@/hooks/useMyIncentives'
import { useIncentiveRewardValues } from '@/hooks/useIncentiveRewardValues'
import { useNowSeconds } from '@/hooks/useNowSeconds'
import {
    DEFAULT_FARM_SORT,
    DEFAULT_FARM_VIEW,
    DEFAULT_MY_FARM_FILTER,
    FARM_PAGE_SIZE,
    MY_FARM_FILTER_OPTIONS,
    clampPage,
    filterMyFarms,
    getFarmStatusAt,
    getTotalPages,
    paginate,
    sortFarms,
} from '@/services/mining/farm-list'
import { getEndIncentiveBlocker, getEndIncentiveBlockerLabel } from '@/services/mining/incentives'
import { formatDateTime, formatDuration } from '@/lib/duration'
import { formatRewardAmount, formatTvl } from '@/lib/format'
import { getDisplayToken } from '@/lib/tokens'
import type { FarmSortKey, FarmView, Incentive, MyFarmFilter } from '@/types/earn'

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 text-right">{children}</span>
        </div>
    )
}

function MyFarmCard({
    incentive,
    valueUsd,
    now,
    onSettled,
}: {
    incentive: Incentive
    valueUsd: number | undefined
    now: number
    onSettled: () => void
}) {
    const status = getFarmStatusAt(incentive, now)
    const rewardToken = getDisplayToken(incentive.rewardTokenInfo)
    const blockerNote = getEndIncentiveBlockerLabel(getEndIncentiveBlocker(incentive))

    return (
        <Card className="flex flex-col overflow-hidden">
            <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                    <FarmIdentity incentive={incentive} />
                    <FarmStatusBadge status={status} />
                </div>

                <Separator className="my-4" />

                <div className="flex flex-1 flex-col gap-3 text-sm">
                    <DetailRow label="Reward model">
                        <ProgramMark program={incentive.program} />
                    </DetailRow>
                    <DetailRow label="Undistributed">
                        <span className="font-mono font-semibold tabular-nums">
                            {formatRewardAmount(
                                incentive.totalRewardUnclaimed,
                                incentive.rewardTokenInfo.decimals
                            )}{' '}
                            {rewardToken.symbol}
                        </span>
                        {valueUsd !== undefined && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                                {formatTvl(valueUsd)}
                            </span>
                        )}
                    </DetailRow>
                    <DetailRow label="Staked positions">
                        <span className="tabular-nums">{incentive.numberOfStakes}</span>
                    </DetailRow>
                    <DetailRow label={status === 'pending' ? 'Starts' : 'Ends'}>
                        <span className="tabular-nums">
                            {formatDateTime(
                                status === 'pending' ? incentive.startTime : incentive.endTime
                            )}
                        </span>
                    </DetailRow>
                    <DetailRow label="Length">
                        {formatDuration(incentive.endTime - incentive.startTime)}
                    </DetailRow>
                </div>

                <EndFarmButton
                    incentive={incentive}
                    onSettled={onSettled}
                    className="mt-4 w-full"
                />
                {blockerNote && (
                    <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                        {blockerNote}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

const EMPTY_COPY: Record<MyFarmFilter, { title: string; description: string }> = {
    ongoing: {
        title: 'No farms running',
        description: 'Your scheduled and running farms will show up here.',
    },
    unclaimed: {
        title: 'Nothing to reclaim',
        description: 'Every finished farm of yours has paid out in full.',
    },
    ended: {
        title: 'No finished farms',
        description: 'Farms that have run their course will show up here.',
    },
}

export function MyFarms() {
    const { isConnected } = useAccount()
    const now = useNowSeconds()
    const { incentives, isLoading, refetch } = useMyIncentives()
    const { valueByIncentiveId } = useIncentiveRewardValues(incentives)

    const [view, setView] = useState<FarmView>(DEFAULT_FARM_VIEW)
    const [sort, setSort] = useState<FarmSortKey>(DEFAULT_FARM_SORT)
    const [filter, setFilter] = useState<MyFarmFilter>(DEFAULT_MY_FARM_FILTER)
    const [page, setPage] = useState(1)

    useEffect(() => {
        setPage(1)
    }, [view, sort, filter])

    const visible = useMemo(
        () =>
            sortFarms(filterMyFarms(incentives, filter, now), sort, {
                now,
                rewardValueUsd: valueByIncentiveId,
            }),
        [incentives, filter, sort, now, valueByIncentiveId]
    )

    const pageSize = FARM_PAGE_SIZE[view]
    const totalPages = getTotalPages(visible.length, pageSize)
    const safePage = clampPage(page, totalPages)
    const pageItems = paginate(visible, safePage, pageSize)

    if (!isConnected || isLoading || incentives.length === 0) return null

    const rangeStart = (safePage - 1) * pageSize + 1
    const rangeEnd = rangeStart + pageItems.length - 1

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-lg font-semibold sm:text-xl">My Farms</h2>
                <FarmListToolbar
                    sort={sort}
                    onSortChange={setSort}
                    view={view}
                    onViewChange={setView}
                    filters={
                        <FarmSelectMenu
                            value={filter}
                            options={MY_FARM_FILTER_OPTIONS}
                            onChange={setFilter}
                            ariaLabel="Filter my farms"
                        />
                    }
                />
            </div>

            {visible.length === 0 ? (
                <EmptyState {...EMPTY_COPY[filter]} />
            ) : (
                <>
                    {view === 'card' ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {pageItems.map((incentive) => (
                                <MyFarmCard
                                    key={incentive.incentiveId}
                                    incentive={incentive}
                                    valueUsd={valueByIncentiveId[incentive.incentiveId]}
                                    now={now}
                                    onSettled={refetch}
                                />
                            ))}
                        </div>
                    ) : (
                        <MyFarmTable
                            incentives={pageItems}
                            rewardValueUsd={valueByIncentiveId}
                            now={now}
                            onSettled={refetch}
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
                </>
            )}
        </div>
    )
}
