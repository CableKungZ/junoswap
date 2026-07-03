export const SWAP_AGGREGATOR_ABI = [
    {
        type: 'function',
        name: 'executeRoute',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'hops',
                type: 'tuple[]',
                components: [
                    { name: 'providerId', type: 'uint256' },
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                ],
            },
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ name: 'amountOut', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'validateRoute',
        stateMutability: 'view',
        inputs: [
            {
                name: 'hops',
                type: 'tuple[]',
                components: [
                    { name: 'providerId', type: 'uint256' },
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                ],
            },
        ],
        outputs: [
            { name: '', type: 'bool' },
            { name: '', type: 'string' },
        ],
    },
    {
        type: 'function',
        name: 'feeBps',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint96' }],
    },
    {
        type: 'function',
        name: 'getProvider',
        stateMutability: 'view',
        inputs: [{ name: 'providerId', type: 'uint256' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'adapter', type: 'address' },
                    { name: 'active', type: 'bool' },
                    { name: 'hasFeeOverride', type: 'bool' },
                    { name: 'feeOverrideBps', type: 'uint16' },
                    { name: 'poolFeeBps', type: 'uint256' },
                ],
            },
        ],
    },
    {
        type: 'function',
        name: 'providerCount',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const

// SmartQuote lens. On-chain these are nonpayable (V3 quoters are nonpayable) but they
// never write state — declared `view` here so viem/wagmi allow plain eth_call reads.
export const SMART_QUOTE_ABI = [
    {
        type: 'function',
        name: 'quoteBest',
        stateMutability: 'view',
        inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'mids', type: 'address[]' },
            { name: 'minImprovementBps', type: 'uint256' },
        ],
        outputs: [
            {
                name: 'hops',
                type: 'tuple[]',
                components: [
                    { name: 'providerId', type: 'uint256' },
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                ],
            },
            { name: 'amountOut', type: 'uint256' },
            { name: 'directOuts', type: 'uint256[]' },
        ],
    },
    {
        type: 'function',
        name: 'quoteAll',
        stateMutability: 'view',
        inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
        ],
        outputs: [{ name: 'outs', type: 'uint256[]' }],
    },
] as const
