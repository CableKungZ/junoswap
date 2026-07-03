import type { Address } from 'viem'
import { bitkub } from './wagmi'

/**
 * SwapAggregator settings — intentionally SEPARATE from lib/dex-config.ts.
 * dex-config drives the normal per-DEX swap tab; this file drives the on-chain
 * SwapAggregator route (providerIds must mirror the order the deploy script
 * registered adapters in, see contracts/script/DeployKubMainnet.s.sol).
 */

export type AggProtocol = 'v2' | 'v3'

export interface AggregatorProvider {
    /** On-chain providerId in the SwapAggregator contract. */
    providerId: number
    /** Grouping key for UI toggles — one DEX may span several providers (V3 fee tiers). */
    dexKey: string
    label: string
    protocol: AggProtocol
    enabled: boolean
    /** V2 router (getAmountsOut) — v2 only. */
    router?: Address
    /** V3 quoter — v3 only. */
    quoter?: Address
    /** v1 = original Quoter (non-struct args, KubleRx); v2 = QuoterV2 struct args. */
    quoterVersion?: 'v1' | 'v2'
    /** V3 pool fee tier — v3 only. */
    feeTier?: number
}

const JUNOSWAP_QUOTER = '0xCB0c6E78519f6B4c1b9623e602E831dEf0f5ff7f' as Address
const KUBLERX_QUOTER = '0x63661462C66f13eD121f394Dc57726c1c33672de' as Address

const KUB_PROVIDERS: AggregatorProvider[] = [
    // V2 — providerIds 0-2 (deploy order: UdonSwap, Ponder, Diamon)
    {
        providerId: 0,
        dexKey: 'udonswap',
        label: 'UdonSwap',
        protocol: 'v2',
        enabled: true,
        router: '0x7aA32A818cD3a6BcdF827f6a411B7adFF56e7A4A' as Address,
    },
    {
        providerId: 1,
        dexKey: 'ponder',
        label: 'Ponder',
        protocol: 'v2',
        enabled: true,
        router: '0xD19C5cebFa9A8919Cc3db2F19163089feBd9604E' as Address,
    },
    {
        providerId: 2,
        dexKey: 'diamon',
        label: 'Diamon',
        protocol: 'v2',
        enabled: true,
        router: '0xAb30a29168D792c5e6a54E4bcF1Aec926a3b20FA' as Address,
    },
    // JunoSwap V3 (QuoterV2) — providerIds 3-6, one per fee tier
    ...([100, 500, 3000, 10000] as const).map((tier, i) => ({
        providerId: 3 + i,
        dexKey: 'junoswap',
        label: `JunoSwap V3 ${tier / 10000}%`,
        protocol: 'v3' as const,
        enabled: true,
        quoter: JUNOSWAP_QUOTER,
        quoterVersion: 'v2' as const,
        feeTier: tier,
    })),
    // KubleRx V3 (Quoter v1) — providerIds 7-10
    ...([100, 500, 3000, 10000] as const).map((tier, i) => ({
        providerId: 7 + i,
        dexKey: 'kublerx',
        label: `KubleRx V3 ${tier / 10000}%`,
        protocol: 'v3' as const,
        enabled: true,
        quoter: KUBLERX_QUOTER,
        quoterVersion: 'v1' as const,
        feeTier: tier,
    })),
]

interface AggregatorChainConfig {
    aggregator: Address
    /** SmartQuote lens — one eth_call finds the best route across all providers. */
    smartQuote: Address
    providers: AggregatorProvider[]
}

const AGGREGATOR_CONFIGS: Record<number, AggregatorChainConfig> = {
    [bitkub.id]: {
        aggregator: (process.env.NEXT_PUBLIC_KUB_MAINNET_AGGREGATOR ??
            '0x83497168C64480DB8c0ff9E1eae049A1D75882BC') as Address,
        smartQuote: (process.env.NEXT_PUBLIC_KUB_MAINNET_SMARTQUOTE ??
            '0x5af1Dc7B8A43F03Ef0CC0298A39C98fDa1F2B7b5') as Address,
        providers: KUB_PROVIDERS,
    },
}

export const AGGREGATOR_SUPPORTED_CHAIN_IDS: number[] = [bitkub.id]

export function getAggregatorConfig(chainId: number): AggregatorChainConfig | undefined {
    const config = AGGREGATOR_CONFIGS[chainId]
    if (!config || config.aggregator === '0x0000000000000000000000000000000000000000') {
        return undefined
    }
    return config
}

export function getAggregatorProviders(
    chainId: number,
    disabledDexKeys: string[] = []
): AggregatorProvider[] {
    const config = getAggregatorConfig(chainId)
    if (!config) return []
    return config.providers.filter((p) => p.enabled && !disabledDexKeys.includes(p.dexKey))
}

/** Unique DEX groups for the settings UI (one toggle per DEX, not per fee tier). */
export function getAggregatorDexKeys(chainId: number): { dexKey: string; label: string }[] {
    const config = AGGREGATOR_CONFIGS[chainId]
    if (!config) return []
    const seen = new Set<string>()
    return config.providers
        .filter((p) => (seen.has(p.dexKey) ? false : (seen.add(p.dexKey), true)))
        .map((p) => ({
            dexKey: p.dexKey,
            label: p.protocol === 'v3' ? p.label.replace(/ \d.*%$/, '') : p.label,
        }))
}

/** Gas cap for SmartQuote eth_calls — quoting all providers over 2 mids is quoter-heavy. */
export const SMART_QUOTE_CALL_GAS = 30_000_000n

/**
 * Intermediary tokens for 2-hop routing, per chain — aggregator's own setting,
 * independent from routing-config's INTERMEDIARY_TOKENS. Order = priority.
 * Empty/missing chain falls back to routing-config.
 */
export const AGGREGATOR_MID_TOKENS: Record<number, Address[]> = {
    [bitkub.id]: [
        '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5' as Address, // KKUB
        '0x7d984C24d2499D840eB3b7016077164e15E5faA6' as Address, // KUSDT
        '0x95013Dcb6A561e6C003AED9C43Fb8B64008aA361' as Address, // LUMI
        '0x21CdC3706B8C7B1836Df0E533Dd884069521350B' as Address, // USDT
        '0x31929a0fd776F971C5dd14bF03e1F9fF69D9c91c' as Address, // USDC.E
    ],
}

/**
 * Max mids sent to SmartQuote per quote. Each extra mid ≈ +2 quoteAll rounds
 * (~2-4M simulation gas) — keep within SMART_QUOTE_CALL_GAS.
 */
export const AGGREGATOR_MAX_MIDS = 2

/** Multi-hop must beat direct by this margin (bps) — 2 hops cost more gas + pool risk. */
export const AGGREGATOR_MIN_MULTIHOP_IMPROVEMENT_BPS = 50
