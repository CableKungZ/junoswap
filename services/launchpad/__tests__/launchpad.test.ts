import { describe, it, expect } from 'vitest'
import {
    formatKub,
    formatKubRounded,
    formatTokenAmount,
    formatCompact,
} from '@/services/launchpad/launchpad'

describe('formatKub', () => {
    it('returns "0" for zero', () => {
        expect(formatKub(0n)).toBe('0')
    })

    it('returns "<0.0001" for very small values', () => {
        expect(formatKub(1n)).toBe('<0.0001')
    })

    it('formats values < 1 with 4 decimals', () => {
        expect(formatKub(5n * 10n ** 17n)).toBe('0.5000')
    })

    it('formats values < 1000 with 2 decimals', () => {
        expect(formatKub(5n * 10n ** 19n)).toBe('50.00')
    })

    it('formats thousands without suffix', () => {
        expect(formatKub(1500n * 10n ** 18n)).toBe('1500.00')
    })

    it('formats millions with commas', () => {
        expect(formatKub(1500000n * 10n ** 18n)).toBe('1,500,000')
    })
})

describe('formatKubRounded', () => {
    it('rounds to the nearest whole KUB', () => {
        // 2369.66 -> 2370, matching the production graduation-estimate figure
        expect(formatKubRounded(236966n * 10n ** 16n)).toBe('2,370')
    })

    it('rounds down when below the midpoint', () => {
        expect(formatKubRounded(236940n * 10n ** 16n)).toBe('2,369')
    })

    it('returns "0" for zero', () => {
        expect(formatKubRounded(0n)).toBe('0')
    })
})

describe('formatTokenAmount', () => {
    it('returns "0" for zero', () => {
        expect(formatTokenAmount(0n)).toBe('0')
    })

    it('uses B suffix for billions', () => {
        expect(formatTokenAmount(1500000000n * 10n ** 18n)).toBe('1.50B')
    })
})

describe('formatCompact', () => {
    it('returns "0" for zero', () => {
        expect(formatCompact(0)).toBe('0')
    })

    it('returns "<0.01" for very small', () => {
        expect(formatCompact(0.001)).toBe('<0.01')
    })

    it('formats values < 1 with 2 decimals', () => {
        expect(formatCompact(0.5)).toBe('0.50')
    })

    it('formats values < 1000 with 0 decimals', () => {
        expect(formatCompact(42)).toBe('42')
    })

    it('uses K suffix with one decimal', () => {
        expect(formatCompact(1500)).toBe('1.5K')
    })

    it('uses M suffix with one decimal', () => {
        expect(formatCompact(1500000)).toBe('1.5M')
    })

    it('uses B suffix with one decimal', () => {
        expect(formatCompact(1500000000)).toBe('1.5B')
    })
})
