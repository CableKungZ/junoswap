'use client'

import { Suspense, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PoolsList } from '@/components/positions/pools'
import { AddLiquidityDialog } from '@/components/positions/add-liquidity-dialog'
import { MiningFarms, StakeDialog } from '@/components/mining'
import type { Incentive, V3PoolData } from '@/types/earn'

function EarnContent() {
    const [selectedIncentive, setSelectedIncentive] = useState<Incentive | null>(null)

    const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)
    const [addLiquidityPool, setAddLiquidityPool] = useState<V3PoolData | null>(null)
    const [isStakeDialogOpen, setIsStakeDialogOpen] = useState(false)

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
    return (
        <div className="flex min-h-screen items-start justify-center p-4 pt-8">
            <div className="w-full max-w-5xl space-y-4">
                <div className="space-y-6">
                    <MiningFarms onStake={openStakeDialog} />
                    <PoolsList onAddLiquidity={openAddLiquidity} />
                </div>
                <AddLiquidityDialog
                    open={isAddLiquidityOpen}
                    initialPool={addLiquidityPool}
                    onClose={() => setIsAddLiquidityOpen(false)}
                    onSuccess={bumpRefresh}
                />
                <StakeDialog
                    open={isStakeDialogOpen}
                    incentive={selectedIncentive}
                    onClose={() => setIsStakeDialogOpen(false)}
                    onAddLiquidity={openAddLiquidity}
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
