'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import type { RangeConfig, RangePreset } from '@/types/earn'
import { RANGE_PRESETS } from '@/types/earn'
import {
    getPresetRange,
    tickToPrice,
    priceToTick,
    nearestUsableTick,
    calculateRangePercentage,
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

    const rangePercent = useMemo(() => {
        if (config.tickLower >= config.tickUpper) return null
        return calculateRangePercentage(config.tickLower, config.tickUpper, currentTick)
    }, [config.tickLower, config.tickUpper, currentTick])

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

    const isCustom = config.preset === 'custom'

    return (
        <div className="space-y-4">
            {/* Strategy Presets */}
            <div>
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">
                    Price Range
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {RANGE_PRESETS.filter((p) => p.value !== 'custom').map((preset) => {
                        const isActive = config.preset === preset.value
                        return (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => handlePresetSelect(preset.value)}
                                className={`text-left px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                                    isActive
                                        ? 'bg-foreground/5 border-foreground/15 text-foreground'
                                        : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                            >
                                <div
                                    className={`text-sm font-medium ${isActive ? 'text-foreground' : ''}`}
                                >
                                    {preset.label}
                                </div>
                                <div className="text-xs mt-0.5 opacity-70">
                                    {preset.description}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Range Visualization */}
            {config.tickLower < config.tickUpper && (
                <div className="space-y-2">
                    {/* Current Price Header */}
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-muted-foreground">Current Price</span>
                        <span className="text-sm font-semibold font-mono tracking-tight">
                            {currentPrice}{' '}
                            <span className="text-muted-foreground font-normal">
                                {token1Symbol}/{token0Symbol}
                            </span>
                        </span>
                    </div>

                    {/* Range Bar */}
                    <div className="relative h-10 bg-muted/30 rounded-xl border border-border/30 px-3 flex items-center">
                        <div className="relative w-full h-1.5 bg-muted-foreground/10 rounded-full">
                            {(() => {
                                const tickRange = config.tickUpper - config.tickLower
                                if (tickRange <= 0) return null
                                const normalizedCurrent =
                                    (currentTick - config.tickLower) / tickRange
                                const padding = 0.08
                                const trackMin = -padding
                                const trackMax = 1 + padding
                                const trackSpan = trackMax - trackMin
                                const rangeLeftPct = ((0 - trackMin) / trackSpan) * 100
                                const rangeRightPct = ((1 - trackMin) / trackSpan) * 100
                                const markerPct = Math.max(
                                    3,
                                    Math.min(97, ((normalizedCurrent - trackMin) / trackSpan) * 100)
                                )
                                return (
                                    <>
                                        <div
                                            className="absolute h-full bg-foreground/25 rounded-full"
                                            style={{
                                                left: `${rangeLeftPct}%`,
                                                right: `${100 - rangeRightPct}%`,
                                            }}
                                        />
                                        <div
                                            className="absolute w-3 h-3 bg-foreground rounded-full -top-[3px] shadow-sm ring-2 ring-foreground/20"
                                            style={{
                                                left: `${markerPct}%`,
                                                transform: 'translateX(-50%)',
                                            }}
                                        />
                                    </>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Price Boundaries */}
                    <div className="flex justify-between">
                        <div className="text-left">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Min
                            </p>
                            <p className="text-xs font-medium font-mono tracking-tight">
                                {config.priceLower}
                            </p>
                        </div>
                        {rangePercent !== null && (
                            <div className="text-center">
                                <p className="text-[10px] text-foreground/60 font-medium">
                                    {rangePercent.lowerPercent > 0
                                        ? `+${Math.abs(rangePercent.lowerPercent).toFixed(0)}%`
                                        : `${Math.abs(rangePercent.lowerPercent).toFixed(0)}%`}{' '}
                                    /{' '}
                                    {rangePercent.upperPercent > 0
                                        ? `+${Math.abs(rangePercent.upperPercent).toFixed(0)}%`
                                        : `${Math.abs(rangePercent.upperPercent).toFixed(0)}%`}
                                </p>
                            </div>
                        )}
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Max
                            </p>
                            <p className="text-xs font-medium font-mono tracking-tight">
                                {config.priceUpper}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Range Toggle */}
            <button
                type="button"
                onClick={() => {
                    if (!isCustom) {
                        handlePresetSelect('custom')
                    }
                }}
                className={`text-xs font-medium transition-colors ${
                    isCustom ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
                {isCustom ? 'Editing custom range' : 'Set custom range'}
                {!isCustom && ' →'}
            </button>

            {/* Custom Range Inputs */}
            {isCustom && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Min Price
                        </p>
                        <Input
                            type="number"
                            step="any"
                            value={config.priceLower}
                            onChange={(e) => handlePriceChange('lower', e.target.value)}
                            placeholder="0.0"
                            className="bg-background/50 border-border/50 font-mono text-sm h-9"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            {token1Symbol} per {token0Symbol}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Max Price
                        </p>
                        <Input
                            type="number"
                            step="any"
                            value={config.priceUpper}
                            onChange={(e) => handlePriceChange('upper', e.target.value)}
                            placeholder="0.0"
                            className="bg-background/50 border-border/50 font-mono text-sm h-9"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            {token1Symbol} per {token0Symbol}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
