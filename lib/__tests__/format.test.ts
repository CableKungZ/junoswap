import { describe, it, expect } from 'vitest'
import { formatAprPercent, formatChartPrice, formatExactAmount } from '@/lib/format'

describe('formatChartPrice', () => {
    it('expands leading zeros in full for tiny values', () => {
        expect(formatChartPrice(9.95e-5)).toBe('0.0000995')
        expect(formatChartPrice(9.9552e-5)).toBe('0.00009955') // 4 significant figures
        expect(formatChartPrice(2.376e-6)).toBe('0.000002376')
    })

    it('trims trailing zeros in the significant digits', () => {
        expect(formatChartPrice(5e-5)).toBe('0.00005')
        expect(formatChartPrice(1e-5)).toBe('0.00001')
    })

    it('handles mantissa rollover from rounding (9.9996e-5 → 1.0e-4)', () => {
        expect(formatChartPrice(9.9996e-5)).toBe('0.0001')
    })

    it('uses adaptive decimals for normal ranges', () => {
        expect(formatChartPrice(0)).toBe('0')
        expect(formatChartPrice(0.6893)).toBe('0.6893')
        expect(formatChartPrice(0.000995)).toBe('0.000995') // ≥ 0.0001 stays decimal
        expect(formatChartPrice(12.3456)).toBe('12.346')
        expect(formatChartPrice(1234.5)).toBe('1234.50')
    })

    it('returns "0" for non-finite input', () => {
        expect(formatChartPrice(Infinity)).toBe('0')
        expect(formatChartPrice(NaN)).toBe('0')
    })
})

describe('formatAprPercent', () => {
    it('separates thousands, keeps one decimal and floors tiny rates', () => {
        expect(formatAprPercent(12_345.6)).toBe('12,346%')
        expect(formatAprPercent(1234.5)).toBe('1,235%')
        expect(formatAprPercent(42.55)).toBe('42.6%')
        expect(formatAprPercent(0.4)).toBe('<1%')
        expect(formatAprPercent(0)).toBe('0%')
        expect(formatAprPercent(null)).toBe('—')
    })
})

describe('formatExactAmount', () => {
    it('separates thousands and never abbreviates', () => {
        expect(formatExactAmount(2000n * 10n ** 18n, 18)).toBe('2,000')
        expect(formatExactAmount(1_234_567n * 10n ** 18n, 18)).toBe('1,234,567')
        expect(formatExactAmount(1500000n, 6)).toBe('1.5')
    })
})
