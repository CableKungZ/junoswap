/**
 * Durianfun bonding-curve market — one contract per token (proxy to the shared
 * BondingCurveMarketV5 implementation, see sc.md). Recovered from their frontend bundle
 * and confirmed against mainnet: buy/sell/approve all executed for real on KUB Chain
 * (launchpad-aggregator/HANDOFF.md §3). Graduated tokens stop trading here — they move
 * to a Kublerx V3 pool, which the existing aggregator already routes.
 *
 * Historical/discovery reads (token list, swap history, holders) used to live here too,
 * scanning raw on-chain logs since Durianfun wasn't indexed anywhere. SDK 0.50.0's ponder
 * indexer now covers Durianfun end-to-end (tagged launchpadId: "durianfun" on the same
 * launchToken/tokenSnapshot/swapEvent/tokenHolder tables Junoswap uses) -- see
 * hooks/useTokenList.ts, hooks/useTokenPriceHistory.ts and services/launchpad/platform-adapter.ts,
 * which now read through the SDK directly instead. Only the trade-execution ABIs and the
 * verified Kublerx pool fee tier (needed for quoting/swapping, not discoverable from the
 * indexer) still live here.
 */
export const durianfunMarketAbi = [
    {
        type: 'function',
        name: 'graduated',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'ammPool',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address' }],
    },
    {
        type: 'function',
        name: 'currentPricePerToken',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'quoteBuy',
        stateMutability: 'view',
        inputs: [{ name: 'kubIn', type: 'uint256' }],
        outputs: [
            { name: 'tokensOut', type: 'uint256' },
            { name: 'actualKubUsed', type: 'uint256' },
            { name: 'feeKub', type: 'uint256' },
            { name: 'refundKub', type: 'uint256' },
            { name: 'willGraduate', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'quoteSell',
        stateMutability: 'view',
        inputs: [{ name: 'tokenIn', type: 'uint256' }],
        outputs: [
            { name: 'kubOut', type: 'uint256' },
            { name: 'feeKub', type: 'uint256' },
            { name: 'executable', type: 'bool' },
            { name: 'reason', type: 'string' },
        ],
    },
    {
        type: 'function',
        name: 'swapExactKubForTokens',
        stateMutability: 'payable',
        inputs: [
            { name: 'minTokensOut', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'referrer', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ name: 'tokensOut', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'swapExactTokensForKub',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenAmountIn', type: 'uint256' },
            { name: 'minKubOut', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'referrer', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ name: 'kubOut', type: 'uint256' }],
    },
] as const

/** Durianfun tokens are plain ERC20 (proven on mainnet — see HANDOFF §3), not KAP20. */
export const durianfunErc20Abi = [
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [{ type: 'address' }, { type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [{ type: 'address' }, { type: 'uint256' }],
        outputs: [{ type: 'bool' }],
    },
] as const

// Verified against real graduated Durianfun pools (matched GeckoTerminal mcap) -- the SDK's
// dex-registry "defaultFeeTier" for kublerx (500) is a generic UI default, not what Durianfun's
// bonding-curve auto-graduation actually locks into.
export const KUBLERX_POOL_FEE = 3000
