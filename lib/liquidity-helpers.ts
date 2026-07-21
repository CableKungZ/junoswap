import {
    MIN_TICK,
    MAX_TICK,
    nearestUsableTick,
    priceFromSqrtPriceX96,
    tickToSqrtPriceX96,
} from '@coshi190/junoswap-sdk'
import type { RangePreset } from '@/types/earn'
import { TICK_SPACING } from '@/types/earn'

/**
 * Display formatting only — the conversion itself routes through the SDK so this stays in step with
 * the TVL and chart paths. The sentinels and precision bands are what the position/pool UIs expect.
 */
export function sqrtPriceX96ToPrice(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number
): string {
    const adjustedPrice = priceFromSqrtPriceX96(sqrtPriceX96, decimals0, decimals1)

    if (adjustedPrice < 1e-30) {
        return '0'
    }
    if (adjustedPrice > 1e35) {
        return '∞'
    }

    if (adjustedPrice < 0.0001) {
        return adjustedPrice.toExponential(4)
    } else if (adjustedPrice < 1) {
        return adjustedPrice.toPrecision(6)
    } else if (adjustedPrice < 10000) {
        return adjustedPrice.toFixed(4)
    } else {
        return adjustedPrice.toFixed(2)
    }
}

/** Display price at a tick, in the same formatting bands as {@link sqrtPriceX96ToPrice}. */
export function tickToPrice(tick: number, decimals0: number, decimals1: number): string {
    return sqrtPriceX96ToPrice(tickToSqrtPriceX96(tick), decimals0, decimals1)
}

export function getTickSpacing(fee: number): number {
    return TICK_SPACING[fee] ?? 60 // Default to 0.3% spacing
}

export function getPresetRange(
    currentTick: number,
    tickSpacing: number,
    preset: RangePreset
): { tickLower: number; tickUpper: number } {
    switch (preset) {
        case 'full':
            return {
                tickLower: nearestUsableTick(MIN_TICK, tickSpacing),
                tickUpper: nearestUsableTick(MAX_TICK, tickSpacing),
            }
        case 'safe': {
            const tickDelta = 4055
            return {
                tickLower: nearestUsableTick(currentTick - tickDelta, tickSpacing),
                tickUpper: nearestUsableTick(currentTick + tickDelta, tickSpacing),
            }
        }
        case 'common': {
            const tickDelta = 1823
            return {
                tickLower: nearestUsableTick(currentTick - tickDelta, tickSpacing),
                tickUpper: nearestUsableTick(currentTick + tickDelta, tickSpacing),
            }
        }
        case 'narrow': {
            const tickDelta = 488
            return {
                tickLower: nearestUsableTick(currentTick - tickDelta, tickSpacing),
                tickUpper: nearestUsableTick(currentTick + tickDelta, tickSpacing),
            }
        }
        case 'custom':
        default:
            return {
                tickLower: nearestUsableTick(currentTick, tickSpacing),
                tickUpper: nearestUsableTick(currentTick, tickSpacing),
            }
    }
}

export function calculateRangePercentage(
    currentTick: number,
    tickLower: number,
    tickUpper: number
): { lowerPercent: number; upperPercent: number } {
    const lowerRatio = Math.pow(1.0001, tickLower - currentTick)
    const upperRatio = Math.pow(1.0001, tickUpper - currentTick)

    return {
        lowerPercent: (lowerRatio - 1) * 100,
        upperPercent: (upperRatio - 1) * 100,
    }
}

export function calculateSliderViewport(
    tickLower: number,
    tickUpper: number,
    preset: RangePreset
): { lower: number; upper: number } {
    if (preset === 'full') {
        return { lower: MIN_TICK, upper: MAX_TICK }
    }

    const midTick = (tickLower + tickUpper) / 2
    const halfSpan = Math.ceil(6050 * 1.2) // ~7260 ticks ≈ ±72% covers Safe + room to drag

    const lower = Math.max(Math.floor(midTick - halfSpan), MIN_TICK)
    const upper = Math.min(Math.ceil(midTick + halfSpan), MAX_TICK)

    return { lower, upper }
}

export function formatFeeTier(fee: number): string {
    return `${(fee / 10000).toFixed(2)}%`
}
