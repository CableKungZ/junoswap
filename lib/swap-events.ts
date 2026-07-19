import {
    fetchAllReferralBindings as sdkFetchAllReferralBindings,
    fetchReferralBindings as sdkFetchReferralBindings,
    fetchNormalizedBondingCurveSwaps,
    fetchNormalizedV3Swaps,
    fetchNormalizedV2Swaps,
    parseV2Swap,
    parseV3Swap,
    type ParsedSwap,
    type SwapFilter,
} from '@coshi190/junoswap-sdk'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import { INTERMEDIARY_TOKENS } from '@/lib/routing-config'

// Swap normalisation now lives in the SDK; re-exported here so existing app imports are stable.
export { parseV2Swap, parseV3Swap }
export type { ParsedSwap, SwapFilter }

export function wrappedNativeFor(chainId: number): string | null {
    return INTERMEDIARY_TOKENS[chainId]?.wrappedNative.toLowerCase() ?? null
}

export function fetchBondingCurveSwaps(chainId: number, filter: SwapFilter): Promise<ParsedSwap[]> {
    return fetchNormalizedBondingCurveSwaps(ponderClient, { chainId, filter })
}

export function fetchV3Swaps(chainId: number, filter: SwapFilter): Promise<ParsedSwap[]> {
    return fetchNormalizedV3Swaps(ponderClient, {
        chainId,
        wrappedNative: wrappedNativeFor(chainId),
        filter,
    })
}

export function fetchV2Swaps(chainId: number, filter: SwapFilter): Promise<ParsedSwap[]> {
    return fetchNormalizedV2Swaps(ponderClient, {
        chainId,
        wrappedNative: wrappedNativeFor(chainId),
        filter,
    })
}

export async function fetchAllReferralBindings(): Promise<Map<string, string[]>> {
    try {
        const rows = await sdkFetchAllReferralBindings(ponderClient)
        const map = new Map<string, string[]>()
        for (const r of rows) {
            const referrer = r.referrer.toLowerCase()
            const list = map.get(referrer) ?? []
            list.push(r.referee.toLowerCase())
            map.set(referrer, list)
        }
        return map
    } catch (e) {
        if (isPonderError(e)) return new Map()
        throw e
    }
}

export async function fetchReferralBindings(referrer: string): Promise<string[]> {
    try {
        const rows = await sdkFetchReferralBindings(ponderClient, {
            referrer: referrer.toLowerCase(),
        })
        return rows.map((r) => r.referee.toLowerCase())
    } catch (e) {
        if (isPonderError(e)) return []
        throw e
    }
}
