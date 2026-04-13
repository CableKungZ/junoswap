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
import { Switch } from '@/components/ui/switch'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

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
            const isBest = bestQuoteDex === dexId
            const priceDiff = priceDifferences[dexId]
            return (
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isBest ? 'text-green-600' : ''}`}>
                        {parseFloat(amountOut).toFixed(6)} {tokenOut.symbol}
                    </span>
                    {!isBest &&
                        priceDiff !== null &&
                        priceDiff !== undefined &&
                        priceDiff !== 0 && (
                            <span className="text-xs text-orange-500">
                                {priceDiff > 0 ? '+' : ''}
                                {priceDiff.toFixed(2)}% vs best
                            </span>
                        )}
                </div>
            )
        }
        return null
    }
    return (
        <div className="space-y-2">
            <Card>
                <CardContent className="p-4">
                    <div
                        onClick={toggleExpanded}
                        className="flex items-center justify-between w-full text-left cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Label className="text-muted-foreground">Swap via:</Label>
                            <span className="font-medium">{selectedDexInfo.displayName}</span>
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
                </CardContent>
            </Card>
            {expanded && (
                <Card>
                    <CardContent className="p-2">
                        {availableDexs.map((dex) => {
                            const isSelected = dex.id === selectedDex
                            const isBest = bestQuoteDex === dex.id
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
                                            ? 'bg-primary/10 hover:bg-primary/15'
                                            : 'hover:bg-muted/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {isBest && <Badge variant="secondary">Best</Badge>}
                                                <span
                                                    className={`font-medium ${
                                                        isSelected ? 'text-primary' : ''
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
                                        {dex.website && (
                                            <a
                                                href={dex.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
