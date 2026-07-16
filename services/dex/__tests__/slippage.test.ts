import { describe, it, expect } from 'vitest'
import { calculateMinOutput } from '@/services/dex/slippage'

describe('calculateMinOutput', () => {
    it('returns full amount at 0 slippage', () => {
        expect(calculateMinOutput(1_000_000n, 0)).toBe(1_000_000n)
    })

    it('floors by slippage bps', () => {
        expect(calculateMinOutput(1_000_000n, 100)).toBe(990_000n) // 1%
        expect(calculateMinOutput(1_000_000n, 50)).toBe(995_000n) // 0.5%
    })

    it('rounds down on fractional results', () => {
        expect(calculateMinOutput(9n, 100)).toBe(8n) // 8.91 -> 8
    })
})
