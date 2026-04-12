'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { parseUnits, formatEther, parseEther } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTokenReserves } from '@/hooks/useTokenReserves'
import { useBondingCurveBuy } from '@/hooks/useBondingCurveBuy'
import { useBondingCurveSell } from '@/hooks/useBondingCurveSell'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useReadContract } from 'wagmi'
import { ERC20_ABI } from '@/lib/abis/erc20'
import { PUMP_CORE_NATIVE_ADDRESS } from '@/lib/abis/pump-core-native'
import { isValidNumberInput } from '@/lib/utils'
import { formatKub, formatTokenAmount } from '@/services/launchpad'
import { toastSuccess, toastError } from '@/lib/toast'
import { getChainMetadata } from '@/lib/wagmi'
import { PUMP_CORE_NATIVE_CHAIN_ID } from '@/lib/abis/pump-core-native'
import { ConnectModal } from '@/components/web3/connect-modal'

interface TokenTradeCardProps {
    tokenAddr: Address
    tokenSymbol?: string
    tokenDecimals?: number
    isGraduated: boolean
}

export function TokenTradeCard({
    tokenAddr,
    tokenSymbol = 'TOKEN',
    tokenDecimals = 18,
    isGraduated: _initialIsGraduated,
}: TokenTradeCardProps) {
    const { address, isConnected } = useAccount()
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
    const [buyAmount, setBuyAmount] = useState('')
    const [sellAmount, setSellAmount] = useState('')

    const {
        nativeReserve,
        tokenReserve,
        isGraduated,
        virtualAmount,
        refetch: refetchReserves,
    } = useTokenReserves({ tokenAddr })

    // User's native KUB balance
    const { data: nativeBalance, refetch: refetchNative } = useBalance({
        address,
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    // User's token balance
    const { data: tokenBalance, refetch: refetchTokens } = useReadContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address || '0x0'],
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
        query: { enabled: !!address },
    })

    // Parse amounts
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
            return parseUnits(sellAmount, tokenDecimals)
        } catch {
            return 0n
        }
    }, [sellAmount, tokenDecimals])

    // Buy hook
    const {
        buy,
        expectedOut: buyExpectedOut,
        minTokenOut,
        isPreparing: isBuyPreparing,
        isExecuting: isBuyExecuting,
        isConfirming: isBuyConfirming,
        isSuccess: isBuySuccess,
        isError: isBuyError,
        error: buyError,
        hash: buyHash,
    } = useBondingCurveBuy({
        tokenAddr,
        nativeAmount: buyAmountWei,
        nativeReserve,
        tokenReserve,
        virtualAmount,
        enabled: !isGraduated,
    })

    // Sell hook
    const {
        sell,
        expectedOut: sellExpectedOut,
        minNativeOut,
        isPreparing: isSellPreparing,
        isExecuting: isSellExecuting,
        isConfirming: isSellConfirming,
        isSuccess: isSellSuccess,
        isError: isSellError,
        error: sellError,
        hash: sellHash,
    } = useBondingCurveSell({
        tokenAddr,
        tokenAmount: sellAmountWei,
        nativeReserve,
        tokenReserve,
        virtualAmount,
        enabled: !isGraduated,
    })

    // Token approval for selling
    const {
        needsApproval: needsSellApproval,
        isApproving: isApprovingSell,
        isConfirming: isConfirmingApproval,
        approve: approveSell,
    } = useTokenApproval({
        token: {
            address: tokenAddr,
            symbol: tokenSymbol,
            name: '',
            decimals: tokenDecimals,
            chainId: PUMP_CORE_NATIVE_CHAIN_ID,
        },
        owner: address,
        spender: PUMP_CORE_NATIVE_ADDRESS,
        amountToApprove: sellAmountWei,
    })

    // Handle buy success
    useEffect(() => {
        if (!isBuySuccess || !buyHash) return
        const metadata = getChainMetadata(PUMP_CORE_NATIVE_CHAIN_ID)
        toastSuccess('Buy successful!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${metadata.explorer}/tx/${buyHash}`, '_blank'),
            },
        })
        setBuyAmount('')
        refetchReserves()
        refetchNative()
        refetchTokens()
    }, [isBuySuccess, buyHash, refetchReserves, refetchNative, refetchTokens])

    // Handle sell success
    useEffect(() => {
        if (!isSellSuccess || !sellHash) return
        const metadata = getChainMetadata(PUMP_CORE_NATIVE_CHAIN_ID)
        toastSuccess('Sell successful!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${metadata.explorer}/tx/${sellHash}`, '_blank'),
            },
        })
        setSellAmount('')
        refetchReserves()
        refetchNative()
        refetchTokens()
    }, [isSellSuccess, sellHash, refetchReserves, refetchNative, refetchTokens])

    // Handle errors
    useEffect(() => {
        if (isBuyError && buyError) toastError(buyError, 'Buy failed')
    }, [isBuyError, buyError])

    useEffect(() => {
        if (isSellError && sellError) toastError(sellError, 'Sell failed')
    }, [isSellError, sellError])

    const handleBuyInputChange = (value: string) => {
        if (isValidNumberInput(value)) setBuyAmount(value)
    }

    const handleSellInputChange = (value: string) => {
        if (isValidNumberInput(value)) setSellAmount(value)
    }

    const handleBuy = () => {
        if (!isConnected) {
            setIsConnectModalOpen(true)
            return
        }
        buy()
    }

    const handleSell = () => {
        if (!isConnected) {
            setIsConnectModalOpen(true)
            return
        }
        if (needsSellApproval) {
            approveSell()
            return
        }
        sell()
    }

    if (isGraduated) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="rounded-lg bg-green-500/10 p-4 text-center">
                        <p className="font-semibold text-green-500">Token Graduated!</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            This token is now trading on Uniswap V3
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardContent className="p-4">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as 'buy' | 'sell')}
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="buy">Buy</TabsTrigger>
                            <TabsTrigger value="sell">Sell</TabsTrigger>
                        </TabsList>

                        {/* Buy Tab */}
                        <TabsContent value="buy" className="mt-4 space-y-3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <Label>Amount (KUB)</Label>
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground"
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
                                <Input
                                    placeholder="0.0"
                                    value={buyAmount}
                                    onChange={(e) => handleBuyInputChange(e.target.value)}
                                />
                            </div>

                            {buyAmountWei > 0n && (
                                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            You receive (est.)
                                        </span>
                                        <span>
                                            {formatTokenAmount(buyExpectedOut)} {tokenSymbol}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Min received</span>
                                        <span>
                                            {formatTokenAmount(minTokenOut)} {tokenSymbol}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fee</span>
                                        <span>1%</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full"
                                onClick={handleBuy}
                                disabled={
                                    isBuyPreparing ||
                                    isBuyExecuting ||
                                    isBuyConfirming ||
                                    buyAmountWei === 0n
                                }
                            >
                                {isBuyExecuting
                                    ? 'Buying...'
                                    : isBuyConfirming
                                      ? 'Confirming...'
                                      : 'Buy'}
                            </Button>
                        </TabsContent>

                        {/* Sell Tab */}
                        <TabsContent value="sell" className="mt-4 space-y-3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <Label>Amount ({tokenSymbol})</Label>
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground"
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
                                <Input
                                    placeholder="0.0"
                                    value={sellAmount}
                                    onChange={(e) => handleSellInputChange(e.target.value)}
                                />
                            </div>

                            {sellAmountWei > 0n && (
                                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            You receive (est.)
                                        </span>
                                        <span>{formatKub(sellExpectedOut)} KUB</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Min received</span>
                                        <span>{formatKub(minNativeOut)} KUB</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fee</span>
                                        <span>1%</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full"
                                onClick={handleSell}
                                disabled={
                                    isSellPreparing ||
                                    isSellExecuting ||
                                    isSellConfirming ||
                                    isApprovingSell ||
                                    isConfirmingApproval ||
                                    sellAmountWei === 0n
                                }
                                variant={needsSellApproval ? 'outline' : 'default'}
                            >
                                {isApprovingSell || isConfirmingApproval
                                    ? 'Approving...'
                                    : needsSellApproval
                                      ? `Approve ${tokenSymbol}`
                                      : isSellExecuting
                                        ? 'Selling...'
                                        : isSellConfirming
                                          ? 'Confirming...'
                                          : 'Sell'}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <ConnectModal open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen} />
        </>
    )
}
