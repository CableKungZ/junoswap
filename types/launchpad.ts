import type { Address } from 'viem'

/**
 * Token created on the bonding curve
 */
export interface LaunchToken {
    address: Address
    name: string
    symbol: string
    logo: string
    description: string
    link1: string
    link2: string
    link3: string
    creator: Address
    createdTime: number
    chainId: number
}

/**
 * Live market data from bonding curve reserves
 */
export interface LaunchTokenMarketData {
    address: Address
    nativeReserve: bigint
    tokenReserve: bigint
    isGraduated: boolean
}

/**
 * Token creation form state
 */
export interface CreateTokenForm {
    name: string
    symbol: string
    logo: string
    description: string
    link1: string
    link2: string
    link3: string
    upfrontBuyAmount: string
}

/**
 * Launchpad settings (persisted)
 */
export interface LaunchpadSettings {
    slippageBps: number // basis points, 100 = 1%
}

/**
 * Default launchpad settings
 */
export const DEFAULT_LAUNCHPAD_SETTINGS: LaunchpadSettings = {
    slippageBps: 100, // 1%
}
