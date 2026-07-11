import { encodeAbiParameters, type Address, type Hex } from 'viem'
import type { RouteQuote } from '@/types/routing'
import { ProtocolType, getV2Config, getV3Config } from '@/lib/dex-config'
import { isNativeToken, shouldSkipUnwrap } from '@/lib/wagmi'
import { buildMultiHopSwapPath } from './uniswap-v2'

/** Sentinel the router uses for the chain's native asset, matching lib/wagmi's. */
export const NATIVE_SENTINEL: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export interface Hop {
    factory: Address
    swapData: Hex
}

export interface Leg {
    amountIn: bigint
    hops: Hop[]
}

export interface AggregateParams {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    minAmountOut: bigint
    recipient: Address
    deadline: bigint
    unwrapOut: boolean
    referrer: Address
}

/** V2 pools are identified by tokenOut alone; V3 needs the fee tier to pick the pool. */
export function encodeHopSwapData(tokenOut: Address, fee?: number): Hex {
    if (fee === undefined) {
        return encodeAbiParameters([{ type: 'address' }], [tokenOut])
    }
    return encodeAbiParameters([{ type: 'address' }, { type: 'uint24' }], [tokenOut, fee])
}

/**
 * A route's `path` carries the native sentinel at its endpoints, but the router resolves
 * pools by wrapped token — so every hop's tokenOut must be normalized first.
 */
export function routeToHops(routeQuote: RouteQuote, chainId: number): Hop[] {
    const { route, dexId, protocolType } = routeQuote
    const isV3 = protocolType === ProtocolType.V3

    const config = isV3 ? getV3Config(chainId, dexId) : getV2Config(chainId, dexId)
    if (!config?.factory) {
        throw new Error(`no ${protocolType} factory for ${dexId} on chain ${chainId}`)
    }

    const wnative = isV3 ? undefined : getV2Config(chainId, dexId)?.wnative
    const path = buildMultiHopSwapPath(route.path, chainId, wnative)
    if (path.length < 2) throw new Error('route path needs at least two tokens')

    const hopCount = path.length - 1
    if (isV3 && route.fees?.length !== hopCount) {
        throw new Error(`v3 route needs ${hopCount} fee tiers, got ${route.fees?.length ?? 0}`)
    }

    return Array.from({ length: hopCount }, (_, i) => {
        const tokenOut = path[i + 1]!
        if (tokenOut.toLowerCase() === path[i]!.toLowerCase()) {
            throw new Error(`hop ${i} resolves to the same token`)
        }
        return {
            factory: config.factory,
            swapData: encodeHopSwapData(tokenOut, isV3 ? route.fees![i] : undefined),
        }
    })
}

/**
 * A hop with its DEX already resolved. Unlike a `RouteQuote` (one `dexId` for the whole route),
 * each hop carries its own `factory`, so a leg can cross DEXes. Token addresses are wrapped.
 */
export interface ResolvedHop {
    dexId: string
    protocol: ProtocolType
    factory: Address
    tokenIn: Address
    tokenOut: Address
    fee?: number
}

/**
 * Encodes a cross-DEX leg to router `Hop[]`, one `swapData` per hop using that hop's own factory.
 * Tokens must already be wrapped (the resolver looks pools up by wrapped token).
 */
export function legToHops(hops: ResolvedHop[]): Hop[] {
    if (hops.length === 0) throw new Error('leg has no hops')
    return hops.map((h, i) => {
        if (h.tokenIn.toLowerCase() === h.tokenOut.toLowerCase()) {
            throw new Error(`hop ${i} resolves to the same token`)
        }
        const isV3 = h.protocol === ProtocolType.V3
        if (isV3 && h.fee === undefined) throw new Error(`v3 hop ${i} missing fee`)
        return {
            factory: h.factory,
            swapData: encodeHopSwapData(h.tokenOut, isV3 ? h.fee : undefined),
        }
    })
}

/** The router requires the legs' inputs to sum to exactly `amountIn`. */
export function buildLegs(allocations: Leg[], amountIn: bigint): Leg[] {
    if (allocations.length === 0) throw new Error('no legs')

    const sum = allocations.reduce((acc, leg) => acc + leg.amountIn, 0n)
    if (sum !== amountIn) throw new Error(`legs sum to ${sum}, expected ${amountIn}`)
    if (allocations.some((leg) => leg.hops.length === 0)) throw new Error('leg has no hops')

    return allocations
}

interface BuildAggregateParamsInput {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    minAmountOut: bigint
    recipient: Address
    deadline: number
    referrer: Address
    chainId: number
}

export function buildAggregateParams({
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    recipient,
    deadline,
    referrer,
    chainId,
}: BuildAggregateParamsInput): AggregateParams {
    return {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        recipient,
        deadline: BigInt(deadline),
        // KKUB gates withdraw behind KYC, so chain 96 takes delivery of the wrapped token
        // and unwraps separately (see useKkubUnwrap).
        unwrapOut: isNativeToken(tokenOut) && !shouldSkipUnwrap(chainId),
        referrer,
    }
}
