import { describe, expect, it } from 'vitest'
import {
    toHolders,
    resolvePlatformAdapter,
    isThirdPartyDataUnavailable,
    v3SwapToSwapEvent,
} from '@/services/launchpad/platform-adapter'
import type { LaunchpadPlatform } from '@/types/launchpad'

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
    it('routes non-graduated durianfun tokens to the ponder adapter (indexed since SDK 0.50.0)', () => {
        const durianfun = resolvePlatformAdapter('durianfun', false, MARKET)
        const junoswap = resolvePlatformAdapter('junoswap', false, undefined)
        expect(durianfun).toBe(junoswap)
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

describe('isThirdPartyDataUnavailable', () => {
    it('is false for durianfun (indexed by ponder since SDK 0.50.0)', () => {
        expect(isThirdPartyDataUnavailable('durianfun', false, MARKET)).toBe(false)
    })

    it('is true for a non-graduated third party with no registered adapter', () => {
        const futurePlatform = 'somefuturelaunchpad' as LaunchpadPlatform
        expect(isThirdPartyDataUnavailable(futurePlatform, false, MARKET)).toBe(true)
    })

    it('is false once the token has graduated (ponder covers it)', () => {
        const futurePlatform = 'somefuturelaunchpad' as LaunchpadPlatform
        expect(isThirdPartyDataUnavailable(futurePlatform, true, MARKET)).toBe(false)
    })

    it('is false without a market address (nothing third-party to fetch)', () => {
        const futurePlatform = 'somefuturelaunchpad' as LaunchpadPlatform
        expect(isThirdPartyDataUnavailable(futurePlatform, false, undefined)).toBe(false)
    })
})

describe('v3SwapToSwapEvent', () => {
    const base = {
        txFrom: '0xabc',
        timestamp: 100,
        transactionHash: '0xhash',
        blockNumber: '7',
    }
    const token = '0x00000000000000000000000000000000000000aa' as const

    it('token paid out by the pool is a buy: native in, token out', () => {
        const e = v3SwapToSwapEvent(
            { ...base, tokenIsToken0: 1, amount0: '-500', amount1: '20' },
            token
        )
        expect(e).toMatchObject({ isBuy: true, amountIn: 20n, amountOut: 500n, sender: '0xabc' })
    })

    it('token paid into the pool is a sell, reading the token from amount1 when token1', () => {
        const e = v3SwapToSwapEvent(
            { ...base, tokenIsToken0: 0, amount0: '-20', amount1: '500' },
            token
        )
        expect(e).toMatchObject({ isBuy: false, amountIn: 500n, amountOut: 20n })
    })
})
