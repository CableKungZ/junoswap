import type { LaunchpadPlatform } from '@/types/launchpad'
import { GRADUATED_POOL_FEE } from './launchpad'
import { KUBLERX_POOL_FEE } from './durianfun'

export interface GraduatedPoolConfig {
    poolFee: number
    dexId?: string
}

/** Where each platform's graduated tokens land: the pool fee tier to quote/swap against, and
 *  the dex id to route through (undefined = Junoswap's own aggregator default). Add a platform
 *  here when it graduates into a pool; nothing calling getGraduatedPoolConfig needs to change. */
const GRADUATED_POOL_CONFIG: Record<LaunchpadPlatform, GraduatedPoolConfig> = {
    junoswap: { poolFee: GRADUATED_POOL_FEE },
    durianfun: { poolFee: KUBLERX_POOL_FEE, dexId: 'kublerx' },
}

export function getGraduatedPoolConfig(
    platform: LaunchpadPlatform | undefined
): GraduatedPoolConfig {
    return GRADUATED_POOL_CONFIG[platform ?? 'junoswap'] ?? GRADUATED_POOL_CONFIG.junoswap
}
