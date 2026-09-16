import { describe, it, expect } from 'vitest'
import { getAddress } from 'viem'
import {
    parseTokenCreatedLog,
    mapDurianfunSwapLogs,
    mapDurianfunTransfersToHolders,
} from '@/services/launchpad/durianfun'

const FACTORY = '0xdf4f3dB298A9aDe853191F58b4b2a322D47EC005' as const
const TOKEN = '0x1111111111111111111111111111111111111111' as const
const MARKET = '0x2222222222222222222222222222222222222222' as const
const CREATOR = '0x3333333333333333333333333333333333333333' as const
const TX_HASH = '0x4444444444444444444444444444444444444444444444444444444444444444' as const

function makeLog(args: Partial<Record<string, unknown>>) {
    return { address: FACTORY, args, transactionHash: TX_HASH } as never
}

describe('parseTokenCreatedLog', () => {
    it('maps a full log to a DurianfunToken tagged with platform durianfun', () => {
        const token = parseTokenCreatedLog(
            makeLog({
                token: TOKEN,
                market: MARKET,
                creator: CREATOR,
                name: 'Test Token',
                symbol: 'TEST',
                totalSupply: 1_000_000n,
                timestamp: 1_700_000_000n,
                graduationTarget: 1,
            })
        )
        expect(token).toEqual({
            address: TOKEN,
            market: MARKET,
            factory: FACTORY,
            creator: CREATOR,
            name: 'Test Token',
            symbol: 'TEST',
            totalSupply: 1_000_000n,
            createdTime: 1_700_000_000,
            graduationTarget: 1,
            platform: 'durianfun',
            txHash: TX_HASH,
        })
    })

    it('returns null when a required arg is missing', () => {
        expect(parseTokenCreatedLog(makeLog({ token: TOKEN, market: MARKET }))).toBeNull()
    })

    it('returns null instead of throwing when args itself is undefined', () => {
        // Regression: a wrong indexed/non-indexed event signature makes viem's getLogs
        // decode fail entirely, leaving log.args undefined rather than partially populated.
        expect(parseTokenCreatedLog({ address: FACTORY, args: undefined } as never)).toBeNull()
    })
})

describe('mapDurianfunSwapLogs', () => {
    const BUYER = '0x9999999999999999999999999999999999999999' as const
    const SELLER = '0x8888888888888888888888888888888888888888' as const
    const BUY_TX = '0x1111111111111111111111111111111111111111111111111111111111111111' as const
    const SELL_TX = '0x2222222222222222222222222222222222222222222222222222222222222222' as const

    it('maps Bought/Sold logs to DurianfunSwapEvent, newest first, using the resolved timestamp', () => {
        const events = mapDurianfunSwapLogs(
            [
                {
                    args: { sender: BUYER, amountIn: 10n, amountOut: 1000n },
                    blockNumber: 100n,
                    transactionHash: BUY_TX,
                },
            ],
            [
                {
                    args: { sender: SELLER, amountIn: 500n, amountOut: 4n },
                    blockNumber: 200n,
                    transactionHash: SELL_TX,
                },
            ],
            new Map([
                [100n, 1_700_000_000],
                [200n, 1_700_000_100],
            ])
        )

        expect(events).toEqual([
            {
                blockNumber: 200n,
                timestamp: 1_700_000_100,
                sender: SELLER,
                isBuy: false,
                amountIn: 500n,
                amountOut: 4n,
                transactionHash: SELL_TX,
            },
            {
                blockNumber: 100n,
                timestamp: 1_700_000_000,
                sender: BUYER,
                isBuy: true,
                amountIn: 10n,
                amountOut: 1000n,
                transactionHash: BUY_TX,
            },
        ])
    })

    it('skips a log missing required args instead of throwing', () => {
        const events = mapDurianfunSwapLogs(
            [{ args: { sender: BUYER }, blockNumber: 100n, transactionHash: BUY_TX }],
            [],
            new Map()
        )
        expect(events).toEqual([])
    })

    it('falls back to timestamp 0 when the block is missing from the resolved map', () => {
        const events = mapDurianfunSwapLogs(
            [
                {
                    args: { sender: BUYER, amountIn: 10n, amountOut: 1000n },
                    blockNumber: 100n,
                    transactionHash: BUY_TX,
                },
            ],
            [],
            new Map()
        )
        expect(events[0]?.timestamp).toBe(0)
    })
})

describe('mapDurianfunTransfersToHolders', () => {
    const MINT = '0x0000000000000000000000000000000000000000' as const
    const HOLDER_A = getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const HOLDER_B = getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')

    it('nets balances from Transfer deltas, excluding the market and zero address', () => {
        const holders = mapDurianfunTransfersToHolders(
            [
                { args: { from: MINT, to: MARKET, value: 1000n } }, // initial mint to market
                { args: { from: MARKET, to: HOLDER_A, value: 400n } }, // buy
                { args: { from: MARKET, to: HOLDER_B, value: 350n } }, // buy
                { args: { from: HOLDER_A, to: MARKET, value: 100n } }, // partial sell
            ],
            new Set([MARKET.toLowerCase(), MINT.toLowerCase()])
        )

        expect(holders).toEqual([
            { address: HOLDER_B, balance: 350n },
            { address: HOLDER_A, balance: 300n },
        ])
    })

    it('drops an address that nets to zero or negative', () => {
        const holders = mapDurianfunTransfersToHolders(
            [
                { args: { from: MINT, to: HOLDER_A, value: 500n } },
                { args: { from: HOLDER_A, to: HOLDER_B, value: 500n } },
            ],
            new Set([MINT.toLowerCase()])
        )
        expect(holders).toEqual([{ address: HOLDER_B, balance: 500n }])
    })
})
