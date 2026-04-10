'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RangeConfig, RangePreset } from '@/types/earn'
import { RANGE_PRESETS } from '@/types/earn'
import {
    getPresetRange,
    tickToPrice,
    priceToTick,
    nearestUsableTick,
} from '@/lib/liquidity-helpers'

interface RangeSelectorProps {
    currentTick: number
    tickSpacing: number
    decimals0: number
    decimals1: number
    token0Symbol: string
    token1Symbol: string
    config: RangeConfig
    onChange: (config: RangeConfig) => void
}

export function RangeSelector({
    currentTick,
    tickSpacing,
    decimals0,
    decimals1,
    token0Symbol,
    token1Symbol,
    config,
    onChange,
}: RangeSelectorProps) {
    const currentPrice = useMemo(() => {
        return tickToPrice(currentTick, decimals0, decimals1)
    }, [currentTick, decimals0, decimals1])
    const handlePresetSelect = (preset: RangePreset) => {
        const { tickLower, tickUpper } = getPresetRange(currentTick, tickSpacing, preset)
        const priceLower = tickToPrice(tickLower, decimals0, decimals1)
        const priceUpper = tickToPrice(tickUpper, decimals0, decimals1)
        onChange({
            preset,
            tickLower,
            tickUpper,
            priceLower,
            priceUpper,
        })
    }
    const handlePriceChange = (bound: 'lower' | 'upper', value: string) => {
        if (!value || isNaN(parseFloat(value))) return
        const tick = priceToTick(value, decimals0, decimals1)
        const alignedTick = nearestUsableTick(tick, tickSpacing)
        const alignedPrice = tickToPrice(alignedTick, decimals0, decimals1)
        if (bound === 'lower') {
            onChange({
                ...config,
                preset: 'custom',
                tickLower: alignedTick,
                priceLower: alignedPrice,
            })
        } else {
            onChange({
                ...config,
                preset: 'custom',
                tickUpper: alignedTick,
                priceUpper: alignedPrice,
            })
        }
    }
    return (
        <div className="space-y-4">
            <div>
                <Label className="text-sm text-muted-foreground">Range Presets</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                    {RANGE_PRESETS.map((preset) => (
                        <Button
                            key={preset.value}
                            type="button"
                            size="sm"
                            variant={config.preset === preset.value ? 'default' : 'outline'}
                            onClick={() => handlePresetSelect(preset.value)}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="text-sm">
                <span className="text-muted-foreground">Current Price: </span>
                <span className="font-medium">
                    {currentPrice} {token1Symbol} per {token0Symbol}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Min Price</Label>
                    <Input
                        type="number"
                        step="any"
                        value={config.priceLower}
                        onChange={(e) => handlePriceChange('lower', e.target.value)}
                        placeholder="0.0"
                    />
                    <p className="text-xs text-muted-foreground">
                        {token1Symbol} per {token0Symbol}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label>Max Price</Label>
                    <Input
                        type="number"
                        step="any"
                        value={config.priceUpper}
                        onChange={(e) => handlePriceChange('upper', e.target.value)}
                        placeholder="0.0"
                    />
                    <p className="text-xs text-muted-foreground">
                        {token1Symbol} per {token0Symbol}
                    </p>
                </div>
            </div>
            <div className="h-16 bg-muted rounded-lg flex items-center justify-center">
                <div className="relative w-full h-2 bg-muted-foreground/20 rounded mx-4">
                    {(() => {
                        const tickRange = config.tickUpper - config.tickLower
                        if (tickRange <= 0) return null
                        const normalizedCurrent = (currentTick - config.tickLower) / tickRange
                        const padding = 0.1
                        const trackMin = -padding
                        const trackMax = 1 + padding
                        const trackSpan = trackMax - trackMin
                        const rangeLeftPct = ((0 - trackMin) / trackSpan) * 100
                        const rangeRightPct = ((1 - trackMin) / trackSpan) * 100
                        const markerPct = Math.max(
                            2,
                            Math.min(98, ((normalizedCurrent - trackMin) / trackSpan) * 100)
                        )
                        return (
                            <>
                                <div
                                    className="absolute h-full bg-primary rounded"
                                    style={{
                                        left: `${rangeLeftPct}%`,
                                        right: `${100 - rangeRightPct}%`,
                                    }}
                                />
                                <div
                                    className="absolute w-1 h-4 bg-foreground rounded -top-1"
                                    style={{ left: `${markerPct}%`, transform: 'translateX(-50%)' }}
                                />
                            </>
                        )
                    })()}
                </div>
            </div>
            {config.tickLower !== config.tickUpper && (
                <div className="text-sm text-muted-foreground text-center">
                    Your position will earn fees when the price is between{' '}
                    <span className="text-foreground">{config.priceLower}</span> and{' '}
                    <span className="text-foreground">{config.priceUpper}</span>
                </div>
            )}
        </div>
    )
}
