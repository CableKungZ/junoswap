'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChainId } from 'wagmi'
import { useDebounce } from './useDebounce'
import { useAggregatorStore } from '@/store/aggregator-store'
import {
    parseSwapSearchParams,
    buildSwapSearchParams,
    parseAndValidateSwapParams,
} from '@/lib/swap-params'
import type { Token } from '@/types/tokens'

const URL_UPDATE_DEBOUNCE_MS = 500

/**
 * Shareable-link sync for the aggregator tab: ?input=&output=&amount=&chain=
 * Same param format as /swap so links are interchangeable between the two pages.
 * Simpler than useSwapUrlSync — the aggregator is single-chain, so there's no
 * chain-switch prompt flow; a mismatched ?chain is just ignored.
 */
export function useAggregatorUrlSync(tokens: Token[]) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chainId = useChainId()
    const { tokenIn, tokenOut, amountIn, setTokenIn, setTokenOut, setAmountIn } =
        useAggregatorStore()
    const hasInitializedRef = useRef(false)
    const isWritingUrlRef = useRef(false)

    // URL → store, once on load. Re-runs as the async token list grows, but only
    // fills slots that are still empty so user picks are never overwritten.
    useEffect(() => {
        const urlParams = parseSwapSearchParams(searchParams)
        const parsed = parseAndValidateSwapParams(chainId, urlParams, tokens)
        if (parsed.targetChainId && parsed.targetChainId !== chainId) return

        const state = useAggregatorStore.getState()
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true
            if (parsed.amountIn) setAmountIn(parsed.amountIn)
        }
        if (parsed.tokenIn && !state.tokenIn) setTokenIn(parsed.tokenIn)
        if (parsed.tokenOut && !state.tokenOut) setTokenOut(parsed.tokenOut)
    }, [searchParams, chainId, tokens, setTokenIn, setTokenOut, setAmountIn])

    // Store → URL, debounced.
    const debouncedTokenIn = useDebounce(tokenIn, URL_UPDATE_DEBOUNCE_MS)
    const debouncedTokenOut = useDebounce(tokenOut, URL_UPDATE_DEBOUNCE_MS)
    const debouncedAmountIn = useDebounce(amountIn, URL_UPDATE_DEBOUNCE_MS)
    useEffect(() => {
        if (!hasInitializedRef.current || isWritingUrlRef.current) return
        const newParams = buildSwapSearchParams({
            input: debouncedTokenIn?.address,
            output: debouncedTokenOut?.address,
            amount: debouncedAmountIn || undefined,
            chain: chainId.toString(),
        })
        const newParamsStr = newParams.toString()
        if (newParamsStr !== searchParams.toString()) {
            isWritingUrlRef.current = true
            router.replace(`${window.location.pathname}${newParamsStr ? `?${newParamsStr}` : ''}`, {
                scroll: false,
            })
            setTimeout(() => {
                isWritingUrlRef.current = false
            }, 100)
        }
    }, [debouncedTokenIn, debouncedTokenOut, debouncedAmountIn, chainId, router, searchParams])
}
