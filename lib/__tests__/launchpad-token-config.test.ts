import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/wagmi', () => ({
    kubTestnet: { id: 25925 },
    bitkub: { id: 96 },
}))

vi.mock('@/lib/launchpad-token-config.json', () => ({
    default: {
        bitkub: {
            '0xaaaa000000000000000000000000000000000001': {
                name: 'Fixed Name',
                symbol: 'FIXED',
                logo: 'ipfs://bafyfixedlogo',
                link2: '',
                link4: 'https://www.facebook.com/example',
                note: 'creator typo in name',
            },
        },
        kubTestnet: {
            '0xBBBB000000000000000000000000000000000002': { symbol: 'TESTNET' },
        },
        // slug with no chain id in lib/wagmi — must be skipped, not crash the loader
        solana: { '0xcccc000000000000000000000000000000000003': { symbol: 'NOPE' } },
    },
}))

const RAW = {
    tokenAddr: '0xAAAA000000000000000000000000000000000001',
    name: 'Typo Nmae',
    symbol: 'TYPO',
    logo: 'ipfs://bafyoldlogo',
    description: 'Original description.',
    link1: 'https://x.com/token',
    link2: 'https://scam.example',
    link3: '',
}

async function getModule() {
    return await import('@/lib/launchpad-token-config')
}

describe('lib/launchpad-token-config', () => {
    it('overrides only the fields the config declares, matching the address case-insensitively', async () => {
        const { applyLaunchpadTokenOverride } = await getModule()
        const result = applyLaunchpadTokenOverride(RAW, 96)

        expect(result.name).toBe('Fixed Name')
        expect(result.symbol).toBe('FIXED')
        expect(result.description).toBe('Original description.')
        expect(result.link1).toBe('https://x.com/token')
        expect(result.tokenAddr).toBe(RAW.tokenAddr)
    })

    it('treats an empty string as an explicit clear', async () => {
        const { applyLaunchpadTokenOverride } = await getModule()
        expect(applyLaunchpadTokenOverride(RAW, 96).link2).toBe('')
    })

    it('routes an override logo through the IPFS gateway resolver', async () => {
        const { applyLaunchpadTokenOverride } = await getModule()
        expect(applyLaunchpadTokenOverride(RAW, 96).logo).toBe(
            'https://cmswap.mypinata.cloud/ipfs/bafyfixedlogo'
        )
    })

    it('ignores unknown config keys so notes cannot leak into token metadata', async () => {
        const { getLaunchpadTokenOverride } = await getModule()
        expect(getLaunchpadTokenOverride('0xaaaa000000000000000000000000000000000001', 96)).toEqual(
            {
                name: 'Fixed Name',
                symbol: 'FIXED',
                logo: 'https://cmswap.mypinata.cloud/ipfs/bafyfixedlogo',
                link2: '',
                link4: 'https://www.facebook.com/example',
            }
        )
    })

    it('adds a fourth link (e.g. Facebook) not present on the raw indexer item', async () => {
        const { applyLaunchpadTokenOverride } = await getModule()
        expect(applyLaunchpadTokenOverride(RAW, 96).link4).toBe('https://www.facebook.com/example')
    })

    it('scopes overrides to a chain and leaves other tokens untouched', async () => {
        const { getLaunchpadTokenOverride, applyLaunchpadTokenOverride } = await getModule()

        // same address, wrong chain
        expect(getLaunchpadTokenOverride(RAW.tokenAddr, 25925)).toBeUndefined()
        expect(applyLaunchpadTokenOverride(RAW, 25925)).toBe(RAW)

        expect(
            getLaunchpadTokenOverride('0xbbbb000000000000000000000000000000000002', 25925)
        ).toEqual({ symbol: 'TESTNET' })
        expect(
            getLaunchpadTokenOverride('0xdddd000000000000000000000000000000000004', 96)
        ).toBeUndefined()
    })

    it('skips chain slugs that are not real chains', async () => {
        const { getLaunchpadTokenOverride } = await getModule()
        expect(
            getLaunchpadTokenOverride('0xcccc000000000000000000000000000000000003', 96)
        ).toBeUndefined()
    })
})
