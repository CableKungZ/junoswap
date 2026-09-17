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

interface LaunchpadPlatformUIConfig {
    /** Pre-graduation trades happen on this platform's own per-token curve contract, so it needs
     *  its own trade widget instead of Junoswap's shared bonding-curve TokenTradeCard. */
    hasOwnCurveTradeUI: boolean
    /** Has its own graduation-progress widget instead of the shared bonding-curve one. */
    hasOwnGraduationUI: boolean
}

/** UI widget selection per platform. Add a platform here to plug in its own trade/graduation
 *  widgets; every composition site (token-detail-page.tsx) reads it instead of branching. */
const PLATFORM_UI_CONFIG: Record<LaunchpadPlatform, LaunchpadPlatformUIConfig> = {
    junoswap: { hasOwnCurveTradeUI: false, hasOwnGraduationUI: false },
    durianfun: { hasOwnCurveTradeUI: true, hasOwnGraduationUI: true },
}

/** True once a token needs its platform's own pre-graduation curve trade widget rather than the
 *  shared bonding-curve one (graduated tokens always trade through the shared post-graduation UI). */
export function usesThirdPartyCurveUI(
    platform: LaunchpadPlatform | undefined,
    isGraduated: boolean | undefined
): boolean {
    if (isGraduated || !platform) return false
    return PLATFORM_UI_CONFIG[platform].hasOwnCurveTradeUI
}

export function hasOwnGraduationUI(platform: LaunchpadPlatform | undefined): boolean {
    return !!platform && PLATFORM_UI_CONFIG[platform].hasOwnGraduationUI
}
