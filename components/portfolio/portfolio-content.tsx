'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount, useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatAddress } from '@/lib/utils'
import { Jazzicon } from '@/components/web3/jazzicon'
import { useNativeUsdPriceContext } from '@/components/launchpad/native-usd-price-provider'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PortfolioSummary } from '@/components/portfolio/portfolio-summary'
import { TokenList } from '@/components/portfolio/token-list'
import { ActivityTab } from '@/components/portfolio/activity-tab'
import { CreatedTokensTab } from '@/components/portfolio/created-tokens-tab'
import { PositionsList } from '@/components/positions/positions-list'
import { AddLiquidityDialog } from '@/components/positions/add-liquidity-dialog'
import { RemoveLiquidityDialog } from '@/components/positions/remove-liquidity-dialog'
import { CollectFeesDialog } from '@/components/positions/collect-fees-dialog'
import { IncreaseLiquidityDialog } from '@/components/positions/increase-liquidity-dialog'
import { UnstakeDialog } from '@/components/mining'
import { usePortfolioTokens } from '@/hooks/usePortfolioTokens'
import { usePortfolioBalances } from '@/hooks/usePortfolioBalances'
import { usePortfolioPrices } from '@/hooks/usePortfolioPrices'
import { useNetWorthHistory } from '@/hooks/useNetWorthHistory'
import { useUserSwapEvents } from '@/hooks/useUserSwapEvents'
import { useNativeUsdPriceHistory } from '@/hooks/useNativeUsdPriceHistory'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { ConnectModal } from '@/components/web3/connect-modal'
import type { PortfolioToken, PortfolioSummary as Summary } from '@/types/portfolio'
import type { PositionWithTokens, StakedPosition } from '@/types/earn'

function useFirstPaintLoading(isSettling: boolean, scope: string): boolean {
    const settledScope = useRef<string | null>(null)
    if (!isSettling) settledScope.current = scope
    return settledScope.current !== scope
}

export function PortfolioContent() {
    const { address: connectedAddress } = useAccount()
    const searchParams = useSearchParams()
    const chainId = useChainId()

    const viewedParam = searchParams.get('address')
    const address = (viewedParam ?? connectedAddress) as `0x${string}` | undefined
    const canManagePositions =
        !!connectedAddress && !!address && connectedAddress.toLowerCase() === address.toLowerCase()
    const { nativeUsdPrice, isLoading: isPriceLoading } = useNativeUsdPriceContext()
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'holdings' | 'positions' | 'created' | 'activity'>(
        'holdings'
    )

    const [selectedPosition, setSelectedPosition] = useState<PositionWithTokens | null>(null)
    const [selectedStakedPosition, setSelectedStakedPosition] = useState<StakedPosition | null>(
        null
    )
    const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)
    const [isRemoveLiquidityOpen, setIsRemoveLiquidityOpen] = useState(false)
    const [isCollectFeesOpen, setIsCollectFeesOpen] = useState(false)
    const [isIncreaseLiquidityOpen, setIsIncreaseLiquidityOpen] = useState(false)
    const [isUnstakeDialogOpen, setIsUnstakeDialogOpen] = useState(false)

    const queryClient = useQueryClient()
    const [positionsRefreshNonce, setPositionsRefreshNonce] = useState(0)
    const bumpPositionsRefresh = useCallback(() => {
        setPositionsRefreshNonce((n) => n + 1)
        queryClient.invalidateQueries()
    }, [queryClient])

    const openAddLiquidity = () => setIsAddLiquidityOpen(true)
    const openRemoveLiquidity = (position: PositionWithTokens) => {
        setSelectedPosition(position)
        setIsRemoveLiquidityOpen(true)
    }
    const openCollectFees = (position: PositionWithTokens) => {
        setSelectedPosition(position)
        setIsCollectFeesOpen(true)
    }
    const openIncreaseLiquidity = (position: PositionWithTokens) => {
        setSelectedPosition(position)
        setIsIncreaseLiquidityOpen(true)
    }
    const openUnstakeDialog = (stakedPosition: StakedPosition) => {
        setSelectedStakedPosition(stakedPosition)
        setIsUnstakeDialogOpen(true)
    }

    const {
        tokens,
        getTokenType,
        isSettled: isTokensSettled,
    } = usePortfolioTokens(chainId, address)
    const {
        holdings,
        isFetching: isBalancesFetching,
        isSettled: isBalancesSettled,
    } = usePortfolioBalances(tokens, chainId, address)
    const { prices, isSettled: isPricesSettled } = usePortfolioPrices(
        holdings,
        nativeUsdPrice,
        chainId,
        getTokenType
    )
    const { data: swapEvents } = useUserSwapEvents(address, chainId)
    const {
        points: nativeUsdHistory,
        priceAt,
        isSettled: isNativeUsdHistorySettled,
    } = useNativeUsdPriceHistory(chainId, nativeUsdPrice)
    const { pnlByToken, totals: pnlTotals } = usePortfolioPnl(swapEvents, holdings, prices, priceAt)

    const portfolioTokens = useMemo<PortfolioToken[]>(() => {
        const result: PortfolioToken[] = []

        for (const [key, holding] of holdings) {
            const priceUsd = prices.get(key) ?? null
            const balanceNum = parseFloat(holding.formattedBalance)
            const valueUsd = priceUsd !== null ? priceUsd * balanceNum : 0
            const pnl = pnlByToken.get(key)
            const tokenType = getTokenType(holding.token)

            result.push({
                token: holding.token,
                balance: holding.rawBalance,
                formattedBalance: holding.formattedBalance,
                priceUsd,
                valueUsd,
                pnlUsd: pnl?.totalPnlUsd ?? null,
                pnlPercent: pnl?.pnlPercent ?? null,
                tokenType,
            })
        }

        return result
    }, [holdings, prices, pnlByToken, getTokenType])

    const summary = useMemo<Summary>(() => {
        const netWorth = portfolioTokens.reduce((sum, t) => sum + t.valueUsd, 0)
        const hasPnl = pnlTotals.totalInvestedUsd > 0
        const totalPnl = hasPnl ? pnlTotals.totalPnlUsd : null
        const totalPnlPercent = hasPnl ? pnlTotals.totalPnlPercent : null

        return { netWorth, totalPnl, totalPnlPercent }
    }, [portfolioTokens, pnlTotals])

    const isHoldingsSettling =
        !isTokensSettled ||
        !isBalancesSettled ||
        isBalancesFetching ||
        !isPricesSettled ||
        isPriceLoading
    const isHistorySettling =
        isHoldingsSettling || swapEvents === undefined || !isNativeUsdHistorySettled

    const scope = `${chainId}:${address ?? ''}`
    const isLoading = useFirstPaintLoading(isHoldingsSettling, scope)
    const isHistoryLoading = useFirstPaintLoading(isHistorySettling, scope)

    const netWorthHistory = useNetWorthHistory({
        address,
        chainId,
        portfolioTokens,
        swapEvents,
        nativeUsdPoints: nativeUsdHistory,
        nativeUsdPrice,
        netWorthNow: summary.netWorth,
        isInputLoading: isHistorySettling,
    })

    if (!address) {
        return (
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <EmptyState
                        title="Connect Wallet"
                        description="Connect your wallet to view your portfolio, track net worth, and monitor PNL."
                    />
                    <div className="flex justify-center">
                        <Button onClick={() => setIsConnectModalOpen(true)}>Connect Wallet</Button>
                    </div>
                    <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-start justify-center p-4 pt-8">
            <div className="w-full max-w-5xl space-y-6">
                <div className="flex items-center gap-3">
                    <Jazzicon
                        address={address}
                        size={32}
                        className="flex-shrink-0 overflow-hidden rounded-full [&>div]:rounded-full"
                    />
                    <h1 className="text-2xl font-bold">
                        <span className="font-mono">{formatAddress(address)}</span>{' '}
                        <span className="text-lg font-normal text-muted-foreground">Portfolio</span>
                    </h1>
                </div>

                <PortfolioSummary
                    summary={summary}
                    history={netWorthHistory}
                    isLoading={isLoading}
                    isHistoryLoading={isHistoryLoading}
                />

                <Tabs
                    value={activeTab}
                    onValueChange={(v) =>
                        setActiveTab(v as 'holdings' | 'positions' | 'created' | 'activity')
                    }
                >
                    <TabsList>
                        <TabsTrigger value="holdings">Holdings</TabsTrigger>
                        <TabsTrigger value="positions">Positions</TabsTrigger>
                        <TabsTrigger value="created">Created</TabsTrigger>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    <TabsContent value="holdings">
                        <TokenList tokens={portfolioTokens} isLoading={isLoading} />
                    </TabsContent>

                    <TabsContent value="positions">
                        <PositionsList
                            address={address}
                            canManage={canManagePositions}
                            onAddLiquidity={openAddLiquidity}
                            onCollectFees={openCollectFees}
                            onRemoveLiquidity={openRemoveLiquidity}
                            onIncreaseLiquidity={openIncreaseLiquidity}
                            onUnstake={openUnstakeDialog}
                            refreshNonce={positionsRefreshNonce}
                        />
                    </TabsContent>

                    <TabsContent value="created">
                        <CreatedTokensTab address={address} canManage={canManagePositions} />
                    </TabsContent>

                    <TabsContent value="activity">
                        <ActivityTab address={address!} chainId={chainId} />
                    </TabsContent>
                </Tabs>

                <AddLiquidityDialog
                    open={isAddLiquidityOpen}
                    initialPool={null}
                    onClose={() => setIsAddLiquidityOpen(false)}
                    onSuccess={bumpPositionsRefresh}
                />
                <RemoveLiquidityDialog
                    open={isRemoveLiquidityOpen}
                    position={selectedPosition}
                    onClose={() => setIsRemoveLiquidityOpen(false)}
                    onSuccess={bumpPositionsRefresh}
                />
                <CollectFeesDialog
                    open={isCollectFeesOpen}
                    position={selectedPosition}
                    onClose={() => setIsCollectFeesOpen(false)}
                    onSuccess={bumpPositionsRefresh}
                />
                <IncreaseLiquidityDialog
                    open={isIncreaseLiquidityOpen}
                    position={selectedPosition}
                    onClose={() => setIsIncreaseLiquidityOpen(false)}
                    onSuccess={bumpPositionsRefresh}
                />
                <UnstakeDialog
                    open={isUnstakeDialogOpen}
                    stakedPosition={selectedStakedPosition}
                    onClose={() => setIsUnstakeDialogOpen(false)}
                    onSuccess={bumpPositionsRefresh}
                />
            </div>
        </div>
    )
}
