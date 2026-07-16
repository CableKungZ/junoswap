import type { Address } from 'viem'
import {
    type ProtocolType,
    type SplitAllocation as SdkSplitAllocation,
} from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import type { DEXType } from '@/lib/dex-meta'
import type { QuoteResult } from './swap'
export interface SwapRoute {
    path: Address[]
    fees?: number[]
    pools?: Address[]
    isMultiHop: boolean
    intermediaryTokens: Token[]
}

export interface RouteQuote {
    route: SwapRoute
    quote: QuoteResult
    dexId: DEXType
    protocolType: ProtocolType
    priceImpact?: number
}

export interface RoutingResult {
    directRoute: RouteQuote | null
    multiHopRoutes: RouteQuote[]
    bestRoute: RouteQuote | null
    allRoutes: RouteQuote[]
}

/** The SDK's generic split allocation, bound to the frontend's RouteQuote. */
export type SplitAllocation = SdkSplitAllocation<RouteQuote>

export interface IntermediaryConfig {
    wrappedNative: Address
    stables: Address[]
    priority: Address[]
}
