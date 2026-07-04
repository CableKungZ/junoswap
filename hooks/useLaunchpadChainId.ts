'use client'

import { createContext, createElement, useContext, type ReactNode } from 'react'
import { useChainId } from 'wagmi'
import {
    BONDING_CURVE_JUNOSWAP_CHAIN_ID,
    getBondingCurveAddress,
    isLaunchpadChain,
} from '@/lib/abis/bonding-curve-junoswap'
import type { Address } from 'viem'

/**
 * Overrides the wallet-derived launchpad chain for a subtree. The token detail page
 * sets this from its `?chain=` URL param so reads (reserves, token list, trades) target
 * the token's own chain regardless of which chain the wallet is connected to.
 */
const LaunchpadChainContext = createContext<number | undefined>(undefined)

export function LaunchpadChainProvider({
    chainId,
    children,
}: {
    chainId: number | undefined
    children: ReactNode
}) {
    return createElement(LaunchpadChainContext.Provider, { value: chainId }, children)
}

/**
 * The launchpad chain the UI currently operates on. Inside a LaunchpadChainProvider
 * (i.e. the token detail page) this is the URL-provided chain; otherwise it is the
 * connected wallet chain when it has a deployed bonding curve, falling back to the
 * default launchpad chain. This lets testnet and mainnet launchpads run in parallel.
 */
export function useLaunchpadChainId(): number {
    const override = useContext(LaunchpadChainContext)
    const chainId = useChainId()
    if (override !== undefined) return override
    return isLaunchpadChain(chainId) ? chainId : BONDING_CURVE_JUNOSWAP_CHAIN_ID
}

/** Connected launchpad chain id + its bonding-curve address, resolved together. */
export function useLaunchpadContract(): { chainId: number; address: Address | undefined } {
    const chainId = useLaunchpadChainId()
    return { chainId, address: getBondingCurveAddress(chainId) }
}
