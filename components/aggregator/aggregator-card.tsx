'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { ArrowDownUp, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TokenSelect } from '@/components/swap/token-select'
import { SettingsDialog } from '@/components/swap/settings-dialog'
import { ConnectModal } from '@/components/web3/connect-modal'
import { useChainTokens } from '@/hooks/useChainTokens'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { useAggregatorQuote } from '@/hooks/useAggregatorQuote'
import { useAggregatorSwap } from '@/hooks/useAggregatorSwap'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useAggregatorUrlSync } from '@/hooks/useAggregatorUrlSync'
import { useAggregatorStore } from '@/store/aggregator-store'
import { getAggregatorConfig } from '@/lib/aggregator-config'
import { calculateMinOutput } from '@/services/dex/uniswap-v2'
import { formatBalance, formatTokenAmount, formatDisplayAmount } from '@/services/tokens'
import { toastError } from '@/lib/toast'
import { isValidNumberInput, safeParseUnits } from '@/lib/utils'
import { getChainMetadata, isNativeToken } from '@/lib/wagmi'

export function AggregatorCard() {
    const chainId = useChainId()
    const { address, isConnected } = useAccount()
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
    const [isRateFlipped, setIsRateFlipped] = useState(false)
    const { tokens } = useChainTokens(chainId)
    const config = getAggregatorConfig(chainId)
    const {
        tokenIn,
        tokenOut,
        amountIn,
        setTokenIn,
        setTokenOut,
        setAmountIn,
        swapTokens,
        settings,
        setSlippage,
        setDeadlineMinutes,
    } = useAggregatorStore()

    // The aggregator routes ERC20s only — hide native KUB (users swap KKUB directly).
    const erc20Tokens = useMemo(() => tokens.filter((t) => !isNativeToken(t.address)), [tokens])

    // Shareable links — same ?input=&output=&amount=&chain= params as /swap.
    useAggregatorUrlSync(erc20Tokens)

    const { balance: balanceIn, refetch: refetchBalanceIn } = useTokenBalance({
        token: tokenIn,
        address,
    })
    const { balance: balanceOut, refetch: refetchBalanceOut } = useTokenBalance({
        token: tokenOut,
        address,
    })

    const amountInBigInt = useMemo(
        () => safeParseUnits(amountIn, tokenIn?.decimals),
        [amountIn, tokenIn]
    )

    const { best, isLoading, isFetching } = useAggregatorQuote({
        tokenIn,
        tokenOut,
        amountIn: amountInBigInt,
        enabled: !!tokenIn && !!tokenOut && amountInBigInt > 0n,
    })

    const approval = useTokenApproval({
        token: tokenIn,
        owner: address,
        spender: config?.aggregator,
        amountToApprove: amountInBigInt,
    })
    const swap = useAggregatorSwap()

    const symbolFor = (addr: Address) =>
        tokens.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.symbol ??
        `${addr.slice(0, 6)}…`

    const displayAmountOut = useMemo(() => {
        if (isLoading) return '...'
        if (best && tokenOut) return formatDisplayAmount(best.netAmountOut, tokenOut.decimals)
        return '0'
    }, [best, isLoading, tokenOut])

    const amountOutMinimum = useMemo(() => {
        if (!best) return 0n
        return calculateMinOutput(best.netAmountOut, Math.floor(settings.slippage * 100))
    }, [best, settings.slippage])

    const [toastedHash, setToastedHash] = useState<string | null>(null)
    useEffect(() => {
        if (swap.isSuccess && swap.hash && swap.hash !== toastedHash) {
            setToastedHash(swap.hash)
            const meta = getChainMetadata(chainId)
            const explorerUrl = meta?.explorer ? `${meta.explorer}/tx/${swap.hash}` : undefined
            toast.success('Swap successful!', {
                action: explorerUrl
                    ? {
                          label: 'View Transaction',
                          onClick: () => window.open(explorerUrl, '_blank', 'noopener,noreferrer'),
                      }
                    : undefined,
            })
            refetchBalanceIn?.()
            refetchBalanceOut?.()
        }
    }, [swap, toastedHash, chainId, refetchBalanceIn, refetchBalanceOut])

    useEffect(() => {
        if (swap.isError && swap.error) toastError(swap.error, 'Swap failed')
    }, [swap.isError, swap.error])

    const insufficientBalance = amountInBigInt > 0n && amountInBigInt > balanceIn
    const needsApproval = !!tokenIn && amountInBigInt > 0n && approval.allowance < amountInBigInt
    const isBusy =
        approval.isApproving || approval.isConfirming || swap.isPending || swap.isConfirming

    const handleMaxAmount = () => {
        if (tokenIn && balanceIn > 0n) setAmountIn(formatTokenAmount(balanceIn, tokenIn.decimals))
    }

    const handleSwapTokens = () => swapTokens()

    const buttonLabel = !isConnected
        ? 'Connect Wallet'
        : !config
          ? 'Unsupported Network'
          : insufficientBalance
            ? 'Insufficient Balance'
            : needsApproval
              ? approval.isApproving
                  ? 'Approving...'
                  : approval.isConfirming
                    ? 'Confirming...'
                    : `Approve ${tokenIn?.symbol ?? 'Token'}`
              : swap.isPending
                ? 'Swapping...'
                : swap.isConfirming
                  ? 'Confirming...'
                  : isLoading
                    ? 'Fetching Quote...'
                    : tokenIn && tokenOut
                      ? amountInBigInt === 0n
                          ? 'Enter Amount'
                          : best
                            ? 'Swap'
                            : 'No Route Found'
                      : 'Select Tokens'

    const buttonDisabled =
        isConnected &&
        (!config ||
            !tokenIn ||
            !tokenOut ||
            amountInBigInt === 0n ||
            insufficientBalance ||
            isLoading ||
            (!needsApproval && !best) ||
            isBusy)

    return (
        <Card>
            <CardContent className="p-0">
                <div className="space-y-2 p-6">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="agg-amount-in">From</Label>
                        <span
                            className="text-xs text-muted-foreground cursor-pointer hover:underline"
                            onClick={handleMaxAmount}
                        >
                            Balance: {tokenIn ? formatBalance(balanceIn, tokenIn.decimals) : '0'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            id="agg-amount-in"
                            type="text"
                            placeholder="0"
                            className="flex-1 h-10 text-2xl font-medium md:text-2xl p-0"
                            autoComplete="off"
                            inputMode="decimal"
                            pattern="^[0-9]*\.?[0-9]*$"
                            value={amountIn}
                            onChange={(e) => {
                                if (isValidNumberInput(e.target.value)) setAmountIn(e.target.value)
                            }}
                        />
                        <TokenSelect token={tokenIn} tokens={erc20Tokens} onSelect={setTokenIn} />
                    </div>
                </div>

                <div className="relative flex items-center justify-center py-1">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative z-10 h-8 w-8 rounded-full border bg-background"
                        onClick={handleSwapTokens}
                        disabled={!tokenIn || !tokenOut}
                    >
                        <ArrowDownUp className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-2 p-6">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="agg-amount-out">To</Label>
                        <span className="text-xs text-muted-foreground">
                            Balance: {tokenOut ? formatBalance(balanceOut, tokenOut.decimals) : '0'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            id="agg-amount-out"
                            type="text"
                            placeholder="0"
                            className="flex-1 h-10 text-2xl font-medium md:text-2xl p-0"
                            readOnly
                            autoComplete="off"
                            value={displayAmountOut}
                        />
                        <TokenSelect token={tokenOut} tokens={erc20Tokens} onSelect={setTokenOut} />
                    </div>
                </div>

                <div className="space-y-4 p-6 pt-0">
                    {best && tokenIn && tokenOut && !isLoading && (
                        <Card className="bg-muted/50 p-1">
                            <CardContent className="space-y-1 p-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rate</span>
                                    <span
                                        className="font-medium cursor-pointer hover:underline flex items-center gap-1"
                                        onClick={() => setIsRateFlipped(!isRateFlipped)}
                                        title="Click to flip rate"
                                    >
                                        {!isRateFlipped ? (
                                            <>
                                                1 {tokenIn.symbol} ={' '}
                                                {parseFloat(amountIn) > 0
                                                    ? (
                                                          parseFloat(displayAmountOut) /
                                                          parseFloat(amountIn)
                                                      ).toFixed(6)
                                                    : '0'}{' '}
                                                {tokenOut.symbol}
                                            </>
                                        ) : (
                                            <>
                                                1 {tokenOut.symbol} ={' '}
                                                {parseFloat(displayAmountOut) > 0
                                                    ? (
                                                          parseFloat(amountIn) /
                                                          parseFloat(displayAmountOut)
                                                      ).toFixed(6)
                                                    : '0'}{' '}
                                                {tokenIn.symbol}
                                            </>
                                        )}
                                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Min. Received</span>
                                    <span className="font-medium">
                                        {formatDisplayAmount(amountOutMinimum, tokenOut.decimals)}{' '}
                                        {tokenOut.symbol}
                                    </span>
                                </div>
                                {best.feeBps > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Aggregator Fee
                                        </span>
                                        <span className="font-medium">
                                            {(best.feeBps / 100).toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Route</span>
                                    <span className="font-medium flex items-center gap-1 flex-wrap justify-end">
                                        {best.isMultiHop && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                2 hops
                                            </Badge>
                                        )}
                                        {best.path.map((addr, i) => (
                                            <span key={i} className="flex items-center gap-1">
                                                {i > 0 && (
                                                    <span
                                                        className="text-muted-foreground"
                                                        title={best.providerLabels[i - 1]}
                                                    >
                                                        →
                                                    </span>
                                                )}
                                                {symbolFor(addr)}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Via</span>
                                    <span className="font-medium">
                                        {best.providerLabels.join(' → ')}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{isFetching && !isLoading ? 'Updating quote...' : ''}</span>
                        <div className="flex items-center gap-1">
                            <SettingsDialog
                                currentSlippage={settings.slippage}
                                currentDeadlineMinutes={settings.deadlineMinutes}
                                onSave={(slippage, deadlineMinutes) => {
                                    setSlippage(slippage)
                                    setDeadlineMinutes(deadlineMinutes)
                                }}
                            />
                            <span>Slippage: {settings.slippage}%</span>
                        </div>
                    </div>

                    <Button
                        className="w-full"
                        size="lg"
                        disabled={buttonDisabled}
                        onClick={() => {
                            if (!isConnected) {
                                setIsConnectModalOpen(true)
                            } else if (needsApproval) {
                                approval.approve()
                            } else if (best && address) {
                                swap.executeRoute({
                                    chainId,
                                    route: best,
                                    amountIn: amountInBigInt,
                                    recipient: address,
                                })
                            }
                        }}
                    >
                        {buttonLabel}
                    </Button>
                </div>
                <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
            </CardContent>
        </Card>
    )
}
