'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { formatEther, parseEther, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAbi } from '@coshi190/juno-moneta-sdk'
import { useDurianfunSwapExecution } from '@/hooks/useDurianfunSwapExecution'
import { isValidNumberInput } from '@/lib/utils'
import { formatKub, formatTokenAmount } from '@/services/launchpad/launchpad'
import { toastSuccess, toastError } from '@/lib/toast'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { TxFlowDialog, actionStep, approvalStep, type TxStep } from '@/components/ui/tx-flow-dialog'
import { TxStageFlow } from '@/components/ui/tx-stage'
import { getDefaultPairTokens } from '@/lib/tokens'
import { getChainMetadata } from '@/lib/wagmi'
import { ConnectModal } from '@/components/web3/connect-modal'
import { SettingsMenu } from '@/components/swap/settings-menu'
import { useSwapStore } from '@/store/swap-store'
import { CURVE_FEE_BPS } from '@/services/launchpad/chart'
import { PercentButtons, AmountButtons } from './token-trade-card'

const DURIANFUN_FEE = `${(CURVE_FEE_BPS.durianfun / 100).toFixed(2)}% (KUB)`

// Junoswap's own address, passed as `referrer` on every Durianfun curve swap — Durianfun
// pays a referral fee share on volume routed through it (see launchpad-aggregator/reference/RECON.md).
const JUNOSWAP_REFERRER: Address = zeroAddress

interface DurianfunTradeCardProps {
    tokenAddr: Address
    tokenSymbol?: string
    tokenLogo?: string
    marketAddr: Address
    chainId: number
}

export function DurianfunTradeCard({
    tokenAddr,
    tokenSymbol = 'TOKEN',
    tokenLogo,
    marketAddr,
    chainId,
}: DurianfunTradeCardProps) {
    const { address, isConnected } = useAccount()
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
    const [buyAmount, setBuyAmount] = useState('')
    const [sellAmount, setSellAmount] = useState('')
    const { settings, setSlippage, setDeadlineMinutes } = useSwapStore()

    const walletChainId = useChainId()
    const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
    const wrongChain = isConnected && walletChainId !== chainId
    const activeChainName = getChainMetadata(chainId)?.name || `Chain ${chainId}`

    const { data: nativeBalance, refetch: refetchNative } = useBalance({ address, chainId })
    const { data: tokenBalance, refetch: refetchTokens } = useReadContract({
        address: tokenAddr,
        abi: getAbi('erc20'),
        functionName: 'balanceOf',
        args: [address ?? zeroAddress],
        chainId,
        query: { enabled: !!address },
    })

    // Assumes 18 decimals — matches TokenDetailPage's `const decimals = 18` for every
    // launchpad token (there's no per-token decimals field anywhere in this feature yet).
    // Verified on-chain for RDA/NOM/HEE/QQK (all 18); re-check if a non-18-decimal
    // Durianfun token ever surfaces.
    const buyAmountWei = useMemo(() => {
        if (!buyAmount || !isValidNumberInput(buyAmount)) return 0n
        try {
            return parseEther(buyAmount)
        } catch {
            return 0n
        }
    }, [buyAmount])

    const sellAmountWei = useMemo(() => {
        if (!sellAmount || !isValidNumberInput(sellAmount)) return 0n
        try {
            return parseEther(sellAmount)
        } catch {
            return 0n
        }
    }, [sellAmount])

    const buyTx = useDurianfunSwapExecution({
        side: 'buy',
        tokenAddr,
        marketAddr,
        amount: buyAmountWei,
        chainId,
        referrer: JUNOSWAP_REFERRER,
        enabled: activeTab === 'buy',
    })

    const sellTx = useDurianfunSwapExecution({
        side: 'sell',
        tokenAddr,
        marketAddr,
        amount: sellAmountWei,
        chainId,
        referrer: JUNOSWAP_REFERRER,
        enabled: activeTab === 'sell',
    })

    // Keyed on the hash; the amounts are cleared from the dialog's Done so its success frame
    // still shows what was traded.
    useOnTxSuccess(true, buyTx.isSuccess, buyTx.hash, (hash) => {
        const metadata = getChainMetadata(chainId)
        toastSuccess('Buy successful!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${metadata.explorer}/tx/${hash}`, '_blank'),
            },
        })
        refetchNative()
        refetchTokens()
    })

    useOnTxSuccess(true, sellTx.isSuccess, sellTx.hash, (hash) => {
        const metadata = getChainMetadata(chainId)
        toastSuccess('Sell successful!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${metadata.explorer}/tx/${hash}`, '_blank'),
            },
        })
        refetchNative()
        refetchTokens()
    })

    useEffect(() => {
        if (buyTx.isError && buyTx.error) toastError(buyTx.error, 'Buy failed')
    }, [buyTx.isError, buyTx.error])

    useEffect(() => {
        if (sellTx.isError && sellTx.error) toastError(sellTx.error, 'Sell failed')
    }, [sellTx.isError, sellTx.error])

    const handleBuyInputChange = (value: string) => {
        if (isValidNumberInput(value)) setBuyAmount(value)
    }

    const handleSellInputChange = (value: string) => {
        if (isValidNumberInput(value)) setSellAmount(value)
    }

    const handleSellPercent = (pct: number) => {
        if (!tokenBalance) return
        const balance = tokenBalance as bigint
        setSellAmount(formatEther((balance * BigInt(pct)) / 100n))
    }

    const [txOpen, setTxOpen] = useState(false)
    const [txKind, setTxKind] = useState<'buy' | 'sell'>('buy')
    // Snapshotted: the approval flips needsApproval off, which would delete the watched step.
    const [flowNeedsApproval, setFlowNeedsApproval] = useState(false)

    const handleBuy = () => {
        if (!isConnected) return setIsConnectModalOpen(true)
        if (wrongChain) return switchChain({ chainId })
        setTxKind('buy')
        setFlowNeedsApproval(false)
        setTxOpen(true)
        buyTx.execute()
    }

    const handleSell = () => {
        if (!isConnected) return setIsConnectModalOpen(true)
        if (wrongChain) return switchChain({ chainId })
        setTxKind('sell')
        setFlowNeedsApproval(sellTx.needsApproval)
        setTxOpen(true)
        if (sellTx.needsApproval) return sellTx.approve()
        sellTx.execute()
    }

    const nativeToken = getDefaultPairTokens(chainId).nativeTokens[0] ?? { symbol: 'KUB' }
    const launchToken = { symbol: tokenSymbol, logo: tokenLogo }
    const isSell = txKind === 'sell'
    const trade = isSell ? sellTx : buyTx
    const nativeSide = {
        kind: 'token' as const,
        token: nativeToken,
        amount: isSell ? formatEther(sellTx.expectedOut) : buyAmount || '0',
    }
    const tokenSide = {
        kind: 'token' as const,
        token: launchToken,
        amount: isSell ? sellAmount || '0' : formatEther(buyTx.expectedOut),
    }
    const txSteps: TxStep[] = []
    if (isSell && flowNeedsApproval) {
        txSteps.push(
            approvalStep({
                token: launchToken,
                spenderLabel: 'Durianfun market',
                spender: marketAddr,
                chainId,
                run: sellTx.approve,
                flags: {
                    isPending: sellTx.isApproving,
                    isConfirming: sellTx.isApproveConfirming,
                    isSuccess: sellTx.isApproveSuccess || !sellTx.needsApproval,
                    isError: !!sellTx.approveError,
                    error: sellTx.approveError,
                    hash: sellTx.approveHash,
                },
            })
        )
    }
    txSteps.push(
        actionStep({
            label: isSell ? `Sell ${tokenSymbol}` : `Buy ${tokenSymbol}`,
            flags: {
                isPending: trade.isExecuting,
                isConfirming: trade.isConfirming,
                isSuccess: trade.isSuccess,
                isError: trade.isError,
                error: trade.error,
                hash: trade.hash,
            },
            run: trade.execute,
            // Follows the approval once the allowance has landed and the sell can be sent.
            autoRun: isSell && !sellTx.needsApproval && sellTx.canExecute,
            renderStage: (phase) => (
                <TxStageFlow
                    phase={phase}
                    chainId={chainId}
                    hash={trade.hash}
                    from={isSell ? tokenSide : nativeSide}
                    to={isSell ? nativeSide : tokenSide}
                />
            ),
        })
    )

    return (
        <>
            <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as 'buy' | 'sell')}
                    >
                        <div className="flex items-center gap-2">
                            <TabsList className="relative grid flex-1 grid-cols-2 rounded-lg bg-muted/40 p-1">
                                <TabsTrigger
                                    value="buy"
                                    className="relative z-10 flex items-center justify-center rounded-md py-2 text-sm font-medium tracking-wide uppercase transition-all duration-200 data-[state=active]:bg-positive data-[state=active]:text-positive-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-positive/20"
                                >
                                    Buy
                                </TabsTrigger>
                                <TabsTrigger
                                    value="sell"
                                    className="relative z-10 flex items-center justify-center rounded-md py-2 text-sm font-medium tracking-wide uppercase transition-all duration-200 data-[state=active]:bg-negative data-[state=active]:text-negative-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-negative/20"
                                >
                                    Sell
                                </TabsTrigger>
                            </TabsList>
                            <SettingsMenu
                                slippage={settings.slippage}
                                deadlineMinutes={settings.deadlineMinutes}
                                onSlippageChange={setSlippage}
                                onDeadlineChange={setDeadlineMinutes}
                            />
                        </div>

                        <TabsContent value="buy" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm min-w-0">
                                    <Label>Amount (KUB)</Label>
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground truncate ml-2"
                                        onClick={() => {
                                            if (nativeBalance?.value) {
                                                setBuyAmount(formatEther(nativeBalance.value))
                                            }
                                        }}
                                    >
                                        Balance:{' '}
                                        {nativeBalance ? formatKub(nativeBalance.value) : '0'} KUB
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        placeholder="0.0"
                                        value={buyAmount}
                                        onChange={(e) => handleBuyInputChange(e.target.value)}
                                        className="h-12 sm:h-14 bg-muted/50 border-0 text-base sm:text-lg font-semibold pr-12 sm:pr-16"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                        KUB
                                    </div>
                                </div>
                                <AmountButtons onSelect={(amt) => setBuyAmount(amt)} />
                            </div>

                            {buyAmountWei > 0n && (
                                <Card className="bg-muted/50 p-1">
                                    <CardContent className="space-y-1 p-3 text-xs">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                You receive (est.)
                                            </span>
                                            <span className="font-medium text-right min-w-0">
                                                {formatTokenAmount(buyTx.expectedOut)} {tokenSymbol}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                Min received
                                            </span>
                                            <span className="font-medium text-right min-w-0">
                                                {formatTokenAmount(buyTx.minOut)} {tokenSymbol}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                Fee
                                            </span>
                                            <span className="font-medium">{DURIANFUN_FEE}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Button
                                variant="default"
                                size="lg"
                                className="w-full"
                                onClick={handleBuy}
                                disabled={
                                    wrongChain
                                        ? isSwitchingChain
                                        : buyTx.isPreparing ||
                                          buyTx.isExecuting ||
                                          buyTx.isConfirming ||
                                          buyAmountWei === 0n ||
                                          (isConnected && buyAmountWei > 0n && !buyTx.canExecute)
                                }
                            >
                                {wrongChain
                                    ? isSwitchingChain
                                        ? 'Switching...'
                                        : `Switch to ${activeChainName}`
                                    : buyTx.isExecuting
                                      ? 'Buying...'
                                      : buyTx.isConfirming
                                        ? 'Confirming...'
                                        : buyTx.isPreparing
                                          ? 'Preparing...'
                                          : 'Buy'}
                            </Button>
                        </TabsContent>

                        <TabsContent value="sell" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm min-w-0">
                                    <Label className="shrink-0">Amount ({tokenSymbol})</Label>
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground truncate ml-2"
                                        onClick={() => {
                                            if (tokenBalance) {
                                                setSellAmount(formatEther(tokenBalance as bigint))
                                            }
                                        }}
                                    >
                                        Balance:{' '}
                                        {tokenBalance
                                            ? formatTokenAmount(tokenBalance as bigint)
                                            : '0'}{' '}
                                        {tokenSymbol}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        placeholder="0.0"
                                        value={sellAmount}
                                        onChange={(e) => handleSellInputChange(e.target.value)}
                                        className="h-12 sm:h-14 bg-muted/50 border-0 text-base sm:text-lg font-semibold pr-14 sm:pr-20"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground max-w-[80px] truncate">
                                        {tokenSymbol}
                                    </div>
                                </div>
                                <PercentButtons onSelect={handleSellPercent} />
                            </div>

                            {sellAmountWei > 0n && (
                                <Card className="bg-muted/50 p-1">
                                    <CardContent className="space-y-1 p-3 text-xs">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                You receive (est.)
                                            </span>
                                            <span className="font-medium text-right min-w-0">
                                                {formatKub(sellTx.expectedOut)} KUB
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                Min received
                                            </span>
                                            <span className="font-medium text-right min-w-0">
                                                {formatKub(sellTx.minOut)} KUB
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">
                                                Fee
                                            </span>
                                            <span className="font-medium">{DURIANFUN_FEE}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {sellTx.sellBlockedReason && (
                                <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                                    {sellTx.sellBlockedReason}
                                </div>
                            )}

                            <Button
                                variant="default"
                                size="lg"
                                className="w-full"
                                onClick={handleSell}
                                disabled={
                                    wrongChain
                                        ? isSwitchingChain
                                        : sellTx.isPreparing ||
                                          sellTx.isExecuting ||
                                          sellTx.isConfirming ||
                                          sellTx.isApproving ||
                                          sellTx.isApproveConfirming ||
                                          sellAmountWei === 0n ||
                                          (isConnected &&
                                              !sellTx.needsApproval &&
                                              sellAmountWei > 0n &&
                                              !sellTx.canExecute)
                                }
                            >
                                {wrongChain
                                    ? isSwitchingChain
                                        ? 'Switching...'
                                        : `Switch to ${activeChainName}`
                                    : sellTx.isApproving || sellTx.isApproveConfirming
                                      ? 'Approving...'
                                      : sellTx.needsApproval
                                        ? `Approve ${tokenSymbol}`
                                        : sellTx.isExecuting
                                          ? 'Selling...'
                                          : sellTx.isConfirming
                                            ? 'Confirming...'
                                            : sellTx.isPreparing
                                              ? 'Preparing...'
                                              : 'Sell'}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title={isSell ? `Sell ${tokenSymbol}` : `Buy ${tokenSymbol}`}
                steps={txSteps}
                chainId={chainId}
                onDone={() => (isSell ? setSellAmount('') : setBuyAmount(''))}
            />
        </>
    )
}
