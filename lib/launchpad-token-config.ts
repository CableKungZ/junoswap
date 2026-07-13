import { bitkub, kubTestnet } from './wagmi'
import { resolveLaunchpadLogo } from './logo'
import overrideData from './launchpad-token-config.json'

export interface LaunchpadTokenOverride {
    name?: string
    symbol?: string
    logo?: string
    description?: string
    link1?: string
    link2?: string
    link3?: string
    link4?: string
}

const OVERRIDABLE_FIELDS = [
    'name',
    'symbol',
    'logo',
    'description',
    'link1',
    'link2',
    'link3',
    'link4',
] as const

const CHAIN_ID_BY_SLUG: Record<string, number> = {
    bitkub: bitkub.id,
    kubTestnet: kubTestnet.id,
}

function pickFields(raw: Record<string, unknown>): LaunchpadTokenOverride {
    const override: LaunchpadTokenOverride = {}
    for (const field of OVERRIDABLE_FIELDS) {
        const value = raw[field]
        if (typeof value !== 'string') continue
        override[field] = field === 'logo' ? resolveLaunchpadLogo(value) : value
    }
    return override
}

const OVERRIDES = new Map<string, LaunchpadTokenOverride>(
    Object.entries(overrideData as Record<string, Record<string, Record<string, unknown>>>).flatMap(
        ([slug, tokens]) => {
            const chainId = CHAIN_ID_BY_SLUG[slug]
            if (!chainId) return []
            return Object.entries(tokens).map(
                ([address, raw]): [string, LaunchpadTokenOverride] => [
                    `${chainId}:${address.toLowerCase()}`,
                    pickFields(raw),
                ]
            )
        }
    )
)

export function getLaunchpadTokenOverride(
    address: string,
    chainId: number
): LaunchpadTokenOverride | undefined {
    return OVERRIDES.get(`${chainId}:${address.toLowerCase()}`)
}

export function applyLaunchpadTokenOverride<T extends { tokenAddr: string }>(
    item: T,
    chainId: number
): T & LaunchpadTokenOverride {
    const override = getLaunchpadTokenOverride(item.tokenAddr, chainId)
    return override ? { ...item, ...override } : item
}
