import { describe, it, expect } from 'vitest'
import { MIN_TICK, MAX_TICK, nearestUsableTick, tickToSqrtPriceX96 } from '@coshi190/junoswap-sdk'
import {
    tickToPrice,
    sqrtPriceX96ToPrice,
    getTickSpacing,
    getPresetRange,
    calculateRangePercentage,
    calculateSliderViewport,
    formatFeeTier,
} from '@/lib/liquidity-helpers'

// The underlying tick/liquidity math now lives in the SDK and is tested there; what remains here is
// the display formatting and the UI range presets.

describe('sqrtPriceX96ToPrice', () => {
    it('collapses vanishingly small prices to "0"', () => {
        expect(sqrtPriceX96ToPrice(1n, 18, 18)).toBe('0')
    })

    it('returns "0" for an uninitialised pool', () => {
        expect(sqrtPriceX96ToPrice(0n, 18, 18)).toBe('0')
    })

    it('formats a mid-range price to 4 decimal places', () => {
        expect(sqrtPriceX96ToPrice(tickToSqrtPriceX96(0), 18, 18)).toBe('1.0000')
    })

    it('switches to exponential notation below 0.0001', () => {
        const price = sqrtPriceX96ToPrice(tickToSqrtPriceX96(-100000), 18, 18)
        expect(price).toMatch(/e-/)
    })

    it('drops to 2 decimal places above 10000', () => {
        const price = sqrtPriceX96ToPrice(tickToSqrtPriceX96(100000), 18, 18)
        expect(price).toMatch(/^\d+\.\d{2}$/)
    })
})

describe('tickToPrice', () => {
    it('reports ~1.0 at tick 0 for matched decimals', () => {
        expect(parseFloat(tickToPrice(0, 18, 18))).toBeCloseTo(1.0, 4)
    })

    it('increases monotonically with tick', () => {
        expect(parseFloat(tickToPrice(1000, 18, 18))).toBeGreaterThan(
            parseFloat(tickToPrice(0, 18, 18))
        )
    })

    it('shifts by the decimal difference', () => {
        expect(parseFloat(tickToPrice(0, 18, 6))).toBeCloseTo(1e12, -6)
    })
})

describe('getTickSpacing', () => {
    it('maps known fee tiers to their spacing', () => {
        expect(getTickSpacing(100)).toBe(1)
        expect(getTickSpacing(500)).toBe(10)
        expect(getTickSpacing(2500)).toBe(50)
        expect(getTickSpacing(3000)).toBe(60)
        expect(getTickSpacing(10000)).toBe(200)
    })

    it('defaults to 0.3% spacing for an unknown fee tier', () => {
        expect(getTickSpacing(9999)).toBe(60)
    })
})

describe('getPresetRange', () => {
    const tickSpacing = 60

    it('full range spans the representable ticks', () => {
        const { tickLower, tickUpper } = getPresetRange(0, tickSpacing, 'full')
        expect(tickLower).toBeLessThan(MIN_TICK + tickSpacing * 2)
        expect(tickUpper).toBeGreaterThan(MAX_TICK - tickSpacing * 2)
    })

    it('widens from narrow through common to safe', () => {
        const width = (preset: 'narrow' | 'common' | 'safe') => {
            const { tickLower, tickUpper } = getPresetRange(0, tickSpacing, preset)
            return tickUpper - tickLower
        }
        expect(width('narrow')).toBeLessThan(width('common'))
        expect(width('common')).toBeLessThan(width('safe'))
    })

    it('centres each preset on the current tick', () => {
        const { tickLower, tickUpper } = getPresetRange(6000, tickSpacing, 'common')
        expect((tickLower + tickUpper) / 2).toBeCloseTo(6000, -2)
    })

    it('custom collapses both bounds onto the current tick', () => {
        const { tickLower, tickUpper } = getPresetRange(100, tickSpacing, 'custom')
        expect(tickLower).toBe(nearestUsableTick(100, tickSpacing))
        expect(tickUpper).toBe(tickLower)
    })
})

describe('calculateRangePercentage', () => {
    it('brackets the current tick with a negative and positive bound', () => {
        const { lowerPercent, upperPercent } = calculateRangePercentage(0, -1000, 1000)
        expect(lowerPercent).toBeLessThan(0)
        expect(upperPercent).toBeGreaterThan(0)
    })

    it('reports 0% when both bounds sit on the current tick', () => {
        expect(calculateRangePercentage(0, 0, 0)).toEqual({ lowerPercent: 0, upperPercent: 0 })
    })
})

describe('calculateSliderViewport', () => {
    it('shows the whole range for the full preset', () => {
        expect(calculateSliderViewport(-1000, 1000, 'full')).toEqual({
            lower: MIN_TICK,
            upper: MAX_TICK,
        })
    })

    it('centres a padded window on the selected range', () => {
        const { lower, upper } = calculateSliderViewport(-1000, 1000, 'common')
        expect(lower).toBeLessThan(-1000)
        expect(upper).toBeGreaterThan(1000)
        expect((lower + upper) / 2).toBeCloseTo(0, -1)
    })

    it('stays inside the representable range near the edges', () => {
        const { lower, upper } = calculateSliderViewport(MIN_TICK, MIN_TICK + 100, 'common')
        expect(lower).toBeGreaterThanOrEqual(MIN_TICK)
        expect(upper).toBeLessThanOrEqual(MAX_TICK)
    })
})

describe('formatFeeTier', () => {
    it('renders fee units as a percentage', () => {
        expect(formatFeeTier(100)).toBe('0.01%')
        expect(formatFeeTier(3000)).toBe('0.30%')
        expect(formatFeeTier(10000)).toBe('1.00%')
    })
})
