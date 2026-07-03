'use client'

import { useMemo, useState } from 'react'
import { useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAggregatorStore } from '@/store/aggregator-store'
import { useAggregatorQuote } from '@/hooks/useAggregatorQuote'
import { getAggregatorDexKeys } from '@/lib/aggregator-config'
import { safeParseUnits } from '@/lib/utils'

/**
 * Per-DEX price comparison + routing toggles for the aggregator tab.
 * Quotes come from the same react-query key as the main card — no extra RPC.
 */
export function AggregatorSettingsCard() {
    const [expanded, setExpanded] = useState(false)
    const chainId = useChainId()
    const { tokenIn, tokenOut, amountIn, settings, toggleDex } = useAggregatorStore()
    const dexes = getAggregatorDexKeys(chainId)

    const amountInBigInt = useMemo(
        () => safeParseUnits(amountIn, tokenIn?.decimals),
        [amountIn, tokenIn]
    )

    const { best, directQuotes } = useAggregatorQuote({
        tokenIn,
        tokenOut,
        amountIn: amountInBigInt,
        enabled: !!tokenIn && !!tokenOut && amountInBigInt > 0n,
    })

    // Best direct quote per DEX group (a V3 DEX spans several fee-tier providers).
    const dexQuotes = useMemo(() => {
        const byDex = new Map<string, bigint>()
        for (const q of directQuotes) {
            const current = byDex.get(q.dexKey) ?? 0n
            if (q.amountOut > current) byDex.set(q.dexKey, q.amountOut)
        }
        return byDex
    }, [directQuotes])

    const bestDexAmount = useMemo(() => {
        let max = 0n
        for (const amount of dexQuotes.values()) if (amount > max) max = amount
        return max
    }, [dexQuotes])

    const enabledCount = dexes.filter((d) => !settings.disabledDexKeys.includes(d.dexKey)).length
    const routeLabel = best ? best.providerLabels.join(' → ') : null

    const renderQuote = (dexKey: string) => {
        if (!tokenOut || amountInBigInt === 0n) return null
        const amount = dexQuotes.get(dexKey)
        if (!amount || amount === 0n) {
            return <span className="text-xs text-muted-foreground">No quote</span>
        }
        const isBest = amount === bestDexAmount
        const diff =
            !isBest && bestDexAmount > 0n
                ? (Number(amount - bestDexAmount) / Number(bestDexAmount)) * 100
                : 0
        return (
            <div className="flex items-center gap-2">
                <span
                    className={`text-sm ${
                        isBest
                            ? 'font-bold bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-transparent'
                            : 'font-normal text-muted-foreground'
                    }`}
                >
                    {parseFloat(formatUnits(amount, tokenOut.decimals)).toFixed(6)}{' '}
                    {tokenOut.symbol}
                </span>
                {!isBest && diff !== 0 && (
                    <span className="text-[10px] text-muted-foreground/50">{diff.toFixed(2)}%</span>
                )}
            </div>
        )
    }

    return (
        <Card>
            <CardContent className="p-4">
                <div
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center justify-between w-full text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Label className="text-muted-foreground shrink-0">Route via:</Label>
                        <span className="font-medium truncate">
                            {routeLabel ?? `${enabledCount}/${dexes.length} DEXes`}
                        </span>
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                </div>
                {expanded && (
                    <div className="mt-3 pt-3 border-t">
                        {dexes.map((dex) => {
                            const enabled = !settings.disabledDexKeys.includes(dex.dexKey)
                            const amount = dexQuotes.get(dex.dexKey)
                            const isBest =
                                enabled && !!amount && amount > 0n && amount === bestDexAmount
                            return (
                                <div
                                    key={dex.dexKey}
                                    className={`flex items-start justify-between gap-3 p-3 rounded-lg ${
                                        enabled ? '' : 'opacity-50'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {isBest && <Badge variant="secondary">Best</Badge>}
                                            <span className="font-medium">{dex.label}</span>
                                        </div>
                                        <div className="mt-1">{renderQuote(dex.dexKey)}</div>
                                    </div>
                                    <Switch
                                        checked={enabled}
                                        // Never allow zero routing sources
                                        disabled={enabled && enabledCount === 1}
                                        onCheckedChange={() => toggleDex(dex.dexKey)}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
