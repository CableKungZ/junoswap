import { describe, expect, it } from 'vitest'
import { toHolders, resolvePlatformAdapter } from '@/services/launchpad/platform-adapter'

describe('toHolders', () => {
    it('drops zero balances, dedupes by address and sorts descending', () => {
        const holders = toHolders([
            { address: '0xaaa', balance: '100' },
            { address: '0xbbb', balance: '0' },
            { address: '0xCCC', balance: '300' },
            { address: '0xccc', balance: '200' },
        ])

        expect(holders.map((h) => h.address)).toEqual(['0xccc', '0xaaa'])
        expect(holders.map((h) => h.balance)).toEqual([200n, 100n])
    })
})

const MARKET = '0x2222222222222222222222222222222222222222' as const

describe('resolvePlatformAdapter', () => {
    it('routes non-graduated durianfun tokens with a market to the durianfun adapter', () => {
        const adapter = resolvePlatformAdapter('durianfun', false, MARKET)
        expect(adapter.fetchSwapHistory).toBeTypeOf('function')
        // Distinguish from the ponder adapter by behavior: durianfun's adapter returns
        // empty immediately when called without a market, ponder's does a network fetch.
        expect(adapter).not.toBe(resolvePlatformAdapter('junoswap', false, undefined))
    })

    it('falls back to the ponder adapter once a durianfun token has graduated', () => {
        const graduated = resolvePlatformAdapter('durianfun', true, MARKET)
        const junoswap = resolvePlatformAdapter('junoswap', true, undefined)
        expect(graduated).toBe(junoswap)
    })

    it('falls back to the ponder adapter when there is no market address', () => {
        const adapter = resolvePlatformAdapter('durianfun', false, undefined)
        expect(adapter).toBe(resolvePlatformAdapter('junoswap', false, undefined))
    })

    it('falls back to the ponder adapter for an unregistered platform', () => {
        const adapter = resolvePlatformAdapter(undefined, false, MARKET)
        expect(adapter).toBe(resolvePlatformAdapter('junoswap', false, undefined))
    })
})
