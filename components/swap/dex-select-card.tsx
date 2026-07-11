'use client'

import { useState, useMemo, useEffect } from 'react'
import { useChainId } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSwapStore } from '@/store/swap-store'
import { useMultiDexQuotes } from '@/hooks/useMultiDexQuotes'
import { DEX_REGISTRY } from '@/types/dex'
import { getSupportedDexs } from '@/lib/dex-config'
import { percentDiff } from '@/lib/routing-config'
import { Switch } from '@/components/ui/switch'
import { ChevronDown, ChevronUp } from 'lucide-react'

const BEST_QUOTE_CLASS =
    'font-bold bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-transparent'

export function DexSelectCard() {
    const [expanded, setExpanded] = useState(false)
    const {
        selectedDex,
        setSelectedDex,
        setAutoSelectBestDex,
        tokenIn,
        tokenOut,
        amountIn,
        settings,
        aggRouteKind,
        aggPredictedOut,
    } = useSwapStore()
    const chainId = useChainId()
    const supportedDexs = getSupportedDexs(chainId)
    const amountInBigInt = useMemo(() => {
        if (!amountIn || !tokenIn) return 0n
        try {
            return parseUnits(amountIn, tokenIn.decimals)
        } catch {
            return 0n
        }
    }, [amountIn, tokenIn])
    const { dexQuotes, bestQuoteDex, priceDifferences } = useMultiDexQuotes({
        tokenIn,
        tokenOut,
        amountIn: amountInBigInt,
        enabled: !!tokenIn && !!tokenOut && amountInBigInt > 0n,
    })
    const aggActive = aggRouteKind !== null && aggPredictedOut !== null
    const aggLabel = aggActive ? 'Junoswap Aggregator' : null
    useEffect(() => {
        if (settings?.autoSelectBestDex && bestQuoteDex && bestQuoteDex !== selectedDex) {
            setSelectedDex(bestQuoteDex)
        }
    }, [bestQuoteDex, selectedDex, setSelectedDex, settings?.autoSelectBestDex])
    const availableDexs = Object.values(DEX_REGISTRY).filter((dex) =>
        supportedDexs.includes(dex.id)
    )
    const selectedDexInfo = DEX_REGISTRY[selectedDex]
    if (!selectedDexInfo) {
        return null
    }
    const toggleExpanded = () => setExpanded(!expanded)
    const renderQuoteInfo = (dexId: string) => {
        const quoteData = dexQuotes[dexId]
        if (!quoteData) return null
        if (quoteData.isLoading) {
            return <span className="text-xs text-muted-foreground">Loading...</span>
        }
        if (quoteData.isError) {
            return <span className="text-xs text-muted-foreground">No quote</span>
        }
        if (quoteData.quote && tokenOut) {
            const amountOut = formatUnits(quoteData.quote.amountOut, tokenOut.decimals)
            const isBest = !aggActive && bestQuoteDex === dexId
            const priceDiff = aggActive
                ? percentDiff(quoteData.quote.amountOut, aggPredictedOut!)
                : priceDifferences[dexId]
            return (
                <div className="flex items-center gap-2">
                    <span
                        className={`text-sm ${isBest ? BEST_QUOTE_CLASS : 'font-normal text-muted-foreground'}`}
                    >
                        {parseFloat(amountOut).toFixed(6)} {tokenOut.symbol}
                    </span>
                    {!isBest &&
                        priceDiff !== null &&
                        priceDiff !== undefined &&
                        priceDiff !== 0 && (
                            <span className="text-[10px] text-muted-foreground/50">
                                {priceDiff > 0 ? '+' : ''}
                                {priceDiff.toFixed(2)}%
                            </span>
                        )}
                </div>
            )
        }
        return null
    }
    return (
        <Card>
            <CardContent className="p-4">
                <div
                    onClick={toggleExpanded}
                    className="flex items-center justify-between w-full text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground">Swap via:</Label>
                        <span className="font-medium">
                            {aggLabel ?? selectedDexInfo.displayName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Label
                                htmlFor="auto-select"
                                className="text-xs text-muted-foreground cursor-pointer"
                            >
                                Auto
                            </Label>
                            <Switch
                                id="auto-select"
                                checked={settings.autoSelectBestDex}
                                onCheckedChange={(checked) => {
                                    setAutoSelectBestDex(checked)
                                    if (checked && bestQuoteDex) {
                                        setSelectedDex(bestQuoteDex)
                                    }
                                }}
                            />
                        </div>
                        {expanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </div>
                </div>
                {expanded && (
                    <div className="mt-3 pt-3 border-t">
                        {aggActive && (
                            <div className="w-full text-left p-3 rounded-lg bg-muted/40">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">Best</Badge>
                                    <span className="font-medium text-foreground">
                                        Junoswap Aggregator
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Split / cross-DEX best route
                                </p>
                                {tokenOut && (
                                    <div className="mt-2">
                                        <span className={`text-sm ${BEST_QUOTE_CLASS}`}>
                                            {parseFloat(
                                                formatUnits(aggPredictedOut!, tokenOut.decimals)
                                            ).toFixed(6)}{' '}
                                            {tokenOut.symbol}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                        {availableDexs.map((dex) => {
                            const isSelected = dex.id === selectedDex
                            const isBest = !aggActive && bestQuoteDex === dex.id
                            return (
                                <button
                                    key={dex.id}
                                    onClick={() => {
                                        setAutoSelectBestDex(false)
                                        setSelectedDex(dex.id)
                                        setExpanded(false)
                                    }}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                                        isSelected
                                            ? 'bg-muted/40 hover:bg-muted/50'
                                            : 'hover:bg-muted/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {isBest && <Badge variant="secondary">Best</Badge>}
                                                <span
                                                    className={`font-medium ${
                                                        isSelected ? 'text-foreground' : ''
                                                    }`}
                                                >
                                                    {dex.displayName}
                                                </span>
                                            </div>
                                            {dex.description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {dex.description}
                                                </p>
                                            )}
                                            <div className="mt-2">{renderQuoteInfo(dex.id)}</div>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
