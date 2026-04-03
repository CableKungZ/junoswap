import type { Token } from './tokens'
import type { Route } from '@lifi/types'

/**
 * Chain IDs supported for bridging
 */
export const BRIDGE_SUPPORTED_CHAIN_IDS = [56, 8453, 480] as const // BSC, Base, Worldchain

export type BridgeChainId = (typeof BRIDGE_SUPPORTED_CHAIN_IDS)[number]

/**
 * Bridge settings
 */
export interface BridgeSettings {
    slippage: number // decimal proportion, 0.03 = 3%
}

/**
 * Bridge state for UI
 */
export interface BridgeState {
    fromChainId: number
    toChainId: number
    fromToken: Token | null
    toToken: Token | null
    amountIn: string
    quote: Route | null
    isLoading: boolean
    error: string | null
}

/**
 * Bridge quote result (LI.FI Route)
 */
export type BridgeQuote = Route
