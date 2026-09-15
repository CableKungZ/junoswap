import { describe, it, expect } from 'vitest'
import { parseTokenCreatedLog } from '@/services/launchpad/durianfun'

const FACTORY = '0xdf4f3dB298A9aDe853191F58b4b2a322D47EC005' as const
const TOKEN = '0x1111111111111111111111111111111111111111' as const
const MARKET = '0x2222222222222222222222222222222222222222' as const
const CREATOR = '0x3333333333333333333333333333333333333333' as const

function makeLog(args: Partial<Record<string, unknown>>) {
    return { address: FACTORY, args } as never
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
        })
    })

    it('returns null when a required arg is missing', () => {
        expect(parseTokenCreatedLog(makeLog({ token: TOKEN, market: MARKET }))).toBeNull()
    })
})
