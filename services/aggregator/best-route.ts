import type { Address, PublicClient, ContractFunctionParameters } from 'viem'
import { decodeFunctionResult, encodeFunctionData } from 'viem'
import { SWAP_AGGREGATOR_ABI, SMART_QUOTE_ABI } from '@/lib/abis/swap-aggregator'
import {
    getAggregatorConfig,
    SMART_QUOTE_CALL_GAS,
    AGGREGATOR_MID_TOKENS,
    AGGREGATOR_MAX_MIDS,
    AGGREGATOR_MIN_MULTIHOP_IMPROVEMENT_BPS,
    type AggregatorProvider,
} from '@/lib/aggregator-config'
import { getIntermediaryTokens } from '@/lib/routing-config'

export interface AggregatorHop {
    providerId: bigint
    tokenIn: Address
    tokenOut: Address
}

export interface ProviderQuote {
    providerId: number
    dexKey: string
    label: string
    amountOut: bigint // gross direct-route output; 0n = no pool / quote failed
}

export interface AggregatorRoute {
    hops: AggregatorHop[]
    path: Address[]
    /** Gross output before the aggregator fee. */
    amountOut: bigint
    /** Output after the aggregator fee (what the recipient receives). */
    netAmountOut: bigint
    /** Effective aggregator fee (bps) — final hop's provider override or global. */
    feeBps: number
    isMultiHop: boolean
    providerLabels: string[]
}

export interface BestRouteResult {
    best: AggregatorRoute | null
    directQuotes: ProviderQuote[]
}

const FEE_DENOMINATOR = 10_000n

/** Global feeBps + per-provider overrides in one multicall. */
async function fetchFees(client: PublicClient, aggregator: Address, providerIds: number[]) {
    try {
        // Mixed functionNames in one multicall defeat viem's per-call inference; type the
        // array as the base contract shape and cast each result (feeBps: uint96, getProvider: struct).
        const contracts: ContractFunctionParameters[] = [
            { address: aggregator, abi: SWAP_AGGREGATOR_ABI, functionName: 'feeBps' },
            ...providerIds.map((id) => ({
                address: aggregator,
                abi: SWAP_AGGREGATOR_ABI,
                functionName: 'getProvider',
                args: [BigInt(id)],
            })),
        ]
        const res = await client.multicall({ contracts, allowFailure: true })
        const feeResult = res[0]
        const globalFeeBps =
            feeResult?.status === 'success' ? Number(feeResult.result as bigint) : 0
        const overrides = new Map<number, number>()
        providerIds.forEach((id, i) => {
            const r = res[i + 1]
            if (!r || r.status !== 'success') return
            const p = r.result as { hasFeeOverride: boolean; feeOverrideBps: number }
            if (p.hasFeeOverride) overrides.set(id, Number(p.feeOverrideBps))
        })
        return { globalFeeBps, overrides }
    } catch {
        return { globalFeeBps: 0, overrides: new Map<number, number>() }
    }
}

/**
 * Best-route search via the on-chain SmartQuote lens: ONE eth_call quotes every
 * provider (direct + 2-hop through the chain's intermediaries with real amounts)
 * and returns hops ready for SwapAggregator.executeRoute. Routes are re-ranked
 * here only to apply the aggregator fee (per-provider override or global).
 *
 * `providers` must already be filtered by the user's DEX toggles; when some are
 * disabled we pick the best from SmartQuote's per-provider table client-side
 * instead of trusting its single best answer.
 */
export async function findBestRoute(params: {
    client: PublicClient
    chainId: number
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    providers: AggregatorProvider[]
}): Promise<BestRouteResult> {
    const { client, chainId, tokenIn, tokenOut, amountIn, providers } = params
    const config = getAggregatorConfig(chainId)
    if (!config || providers.length === 0 || amountIn === 0n) {
        return { best: null, directQuotes: [] }
    }

    const inLower = tokenIn.toLowerCase()
    const outLower = tokenOut.toLowerCase()
    const mids = (AGGREGATOR_MID_TOKENS[chainId] ?? getIntermediaryTokens(chainId))
        .filter((t) => t.toLowerCase() !== inLower && t.toLowerCase() !== outLower)
        .slice(0, AGGREGATOR_MAX_MIDS)

    const enabledIds = new Set(providers.map((p) => p.providerId))
    const allEnabled = enabledIds.size === config.providers.length

    const feesPromise = fetchFees(client, config.aggregator, Array.from(enabledIds))

    let bestHops: readonly AggregatorHop[] = []
    let smartBestOut = 0n
    let directOuts: readonly bigint[] = []
    try {
        // readContract can't pass a gas cap in viem 2.x; use call + decode so the heavy
        // quoteBest simulation gets SMART_QUOTE_CALL_GAS instead of the RPC default.
        const { data } = await client.call({
            to: config.smartQuote,
            data: encodeFunctionData({
                abi: SMART_QUOTE_ABI,
                functionName: 'quoteBest',
                args: [
                    tokenIn,
                    tokenOut,
                    amountIn,
                    mids,
                    BigInt(AGGREGATOR_MIN_MULTIHOP_IMPROVEMENT_BPS),
                ],
            }),
            gas: SMART_QUOTE_CALL_GAS,
        })
        const quote = decodeFunctionResult({
            abi: SMART_QUOTE_ABI,
            functionName: 'quoteBest',
            data: data ?? '0x',
        })
        ;[bestHops, smartBestOut, directOuts] = quote
    } catch {
        // quoteBest simulates every provider over the mids and can exceed an RPC's
        // eth_call gas cap (see SMART_QUOTE_CALL_GAS). Degrade to the direct-only lens —
        // no mids, far lighter — so a single-hop route is still offered.
        try {
            directOuts = await client.readContract({
                address: config.smartQuote,
                abi: SMART_QUOTE_ABI,
                functionName: 'quoteAll',
                args: [tokenIn, tokenOut, amountIn],
            })
        } catch {
            return { best: null, directQuotes: [] }
        }
    }
    const fees = await feesPromise

    const directQuotes: ProviderQuote[] = providers.map((p) => ({
        providerId: p.providerId,
        dexKey: p.dexKey,
        label: p.label,
        amountOut: directOuts[p.providerId] ?? 0n,
    }))

    const labelOf = (id: bigint) =>
        config.providers.find((p) => p.providerId === Number(id))?.label ?? `#${id}`

    const toRoute = (hops: readonly AggregatorHop[], amountOut: bigint): AggregatorRoute => {
        // callers only pass non-empty hops (SmartQuote winner or a 1-hop direct fallback)
        const first = hops[0]!
        const last = hops[hops.length - 1]!
        const finalId = Number(last.providerId)
        const feeBps = fees.overrides.get(finalId) ?? fees.globalFeeBps
        return {
            hops: hops.map((h) => ({ ...h })),
            path: [first.tokenIn, ...hops.map((h) => h.tokenOut)],
            amountOut,
            netAmountOut: amountOut - (amountOut * BigInt(feeBps)) / FEE_DENOMINATOR,
            feeBps,
            isMultiHop: hops.length > 1,
            providerLabels: hops.map((h) => labelOf(h.providerId)),
        }
    }

    // Fast path: nothing disabled → trust SmartQuote's answer as-is.
    const smartQuoteRouteUsable =
        bestHops.length > 0 &&
        (allEnabled || bestHops.every((h) => enabledIds.has(Number(h.providerId))))
    if (smartQuoteRouteUsable) {
        return { best: toRoute(bestHops, smartBestOut), directQuotes }
    }

    // Some DEX in the winning route is toggled off → fall back to the best
    // ENABLED direct quote from the per-provider table.
    const bestDirect = directQuotes.reduce<ProviderQuote | null>(
        (a, b) => (b.amountOut > (a?.amountOut ?? 0n) ? b : a),
        null
    )
    if (!bestDirect || bestDirect.amountOut === 0n) return { best: null, directQuotes }
    return {
        best: toRoute(
            [{ providerId: BigInt(bestDirect.providerId), tokenIn, tokenOut }],
            bestDirect.amountOut
        ),
        directQuotes,
    }
}
