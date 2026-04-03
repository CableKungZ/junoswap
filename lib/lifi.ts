'use client'

import { createConfig, EVM } from '@lifi/sdk'
import type { Client as LifIClient } from '@lifi/sdk/node_modules/viem'
import { getConnectorClient } from '@wagmi/core'
import { wagmiConfig } from './wagmi'

/**
 * Get a viem wallet client for the LI.FI SDK to use for executing transactions.
 * This bridges wagmi's connector system with LI.FI's EVM provider.
 *
 * We cast to the LI.FI SDK's bundled viem Client type to bridge the minor
 * type differences between the project's viem version and the SDK's bundled one.
 * At runtime the client object is fully compatible.
 */
async function getWalletClient() {
    const client = await getConnectorClient(wagmiConfig)
    return client as unknown as LifIClient
}

/**
 * Initialize the LI.FI SDK with:
 * - integrator: identifies CMswap for fee collection
 * - fee: 3% integrator fee (requires LI.FI whitelisting to activate)
 * - EVM provider: bridges wagmi wallet client for tx execution
 */
export const lifiConfig = createConfig({
    integrator: 'cmswap',
    routeOptions: {
        fee: 0.03, // 3% integrator fee — deducted from fromToken
    },
    providers: [
        EVM({
            getWalletClient,
        }),
    ],
})
