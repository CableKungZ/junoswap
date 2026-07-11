import type { Address } from 'viem'
import { ProtocolType, getV2Config, getV3Config, getDexsByProtocol } from '@/lib/dex-config'
import { poolKey } from '@/hooks/useV3PoolDiscovery'
import type { ResolvedHop } from './agg-router'

/**
 * Cross-DEX multi-hop routing: a leg whose hops may each be on a different DEX (e.g. KKUB→USDT
 * on Udonswap, then USDT→X on Junoswap). No single DEX router can do this, so a cross-DEX leg can
 * beat every single-DEX route. Outputs are predicted by quoting each hop on-chain and chaining
 * sequentially; a candidate whose pools don't exist simply fails to quote and is dropped.
 */

/** One quotable way to swap a token pair on a specific DEX (and V3 fee tier). */
export interface HopOption {
    dexId: string
    protocol: ProtocolType
    factory: Address
    /** Router (V2) or quoter (V3) — the contract to call for a quote. */
    quoteAddress: Address
    tokenIn: Address
    tokenOut: Address
    fee?: number
}

/** A resolved cross-DEX leg with its exact predicted output and the pools it touches. */
export interface LegCandidate {
    hops: ResolvedHop[]
    predictedOut: bigint
    /** Order-independent keys of every pool used, for split dedup (Phase 6c). */
    poolKeys: string[]
}

/**
 * Every quotable option for swapping `tokenInW`→`tokenOutW` (already wrapped) across all DEXes on
 * the chain: one per V2 DEX, and one per (V3 DEX × fee tier). Options whose pools don't exist are
 * pruned later by their quote failing, so no separate discovery pass is needed.
 */
export function candidateHopOptions(
    tokenInW: Address,
    tokenOutW: Address,
    chainId: number
): HopOption[] {
    if (tokenInW.toLowerCase() === tokenOutW.toLowerCase()) return []
    const options: HopOption[] = []

    for (const dexId of getDexsByProtocol(chainId, ProtocolType.V2)) {
        const cfg = getV2Config(chainId, dexId)
        if (!cfg?.factory || !cfg.router) continue
        options.push({
            dexId,
            protocol: ProtocolType.V2,
            factory: cfg.factory,
            quoteAddress: cfg.router,
            tokenIn: tokenInW,
            tokenOut: tokenOutW,
        })
    }

    for (const dexId of getDexsByProtocol(chainId, ProtocolType.V3)) {
        const cfg = getV3Config(chainId, dexId)
        if (!cfg?.factory || !cfg.quoter || !cfg.feeTiers) continue
        for (const fee of cfg.feeTiers) {
            options.push({
                dexId,
                protocol: ProtocolType.V3,
                factory: cfg.factory,
                quoteAddress: cfg.quoter,
                tokenIn: tokenInW,
                tokenOut: tokenOutW,
                fee,
            })
        }
    }

    return options
}

/** Highest-output option among the quoted candidates, or null if none quoted. */
export function pickBestHopOption(
    options: HopOption[],
    outputs: (bigint | null)[]
): { option: HopOption; output: bigint } | null {
    let best: { option: HopOption; output: bigint } | null = null
    for (let i = 0; i < options.length; i++) {
        const out = outputs[i]
        if (out == null || out <= 0n) continue
        if (!best || out > best.output) best = { option: options[i]!, output: out }
    }
    return best
}

function toResolvedHop(o: HopOption): ResolvedHop {
    return {
        dexId: o.dexId,
        protocol: o.protocol,
        factory: o.factory,
        tokenIn: o.tokenIn,
        tokenOut: o.tokenOut,
        fee: o.fee,
    }
}

function optionPoolKey(o: HopOption): string {
    return poolKey(o.factory, o.tokenIn, o.tokenOut, o.fee ?? 0)
}

/** Assembles a two-hop cross-DEX leg from the best option chosen for each hop. */
export function buildCrossDexLeg(
    hop1: { option: HopOption; output: bigint },
    hop2: { option: HopOption; output: bigint }
): LegCandidate {
    return {
        hops: [toResolvedHop(hop1.option), toResolvedHop(hop2.option)],
        predictedOut: hop2.output,
        poolKeys: [optionPoolKey(hop1.option), optionPoolKey(hop2.option)],
    }
}
