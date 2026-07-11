import { zeroAddress, type Address } from 'viem'

// kub mainnet (chain 96). An earlier deploy (0x183E1961…96e3) registered udonswap and diamon
// as KIND_V2, but their pairs expose `swap(uint,uint,address)` (no flash-swap `data` arg) and
// reverted at dispatch. This redeploy registers those two as KIND_V2_NODATA; verified on-chain
// by simulating a real udonswap leg and a udonswap+junoswap split.
export const AGG_ROUTER_JUNOSWAP_BITKUB_ADDRESS =
    '0x532cbec4ADb30Aa4F474c9F71907901729e1917C' as const

const AGG_ROUTER_CHAIN_CONFIG: Record<number, { address: Address }> = {
    96: { address: AGG_ROUTER_JUNOSWAP_BITKUB_ADDRESS },
}

// Returns the aggregation-router address for a chain, or undefined where it is not
// deployed. Chains absent here keep routing through each DEX's own router.
export function getAggRouterAddress(chainId: number): Address | undefined {
    const address = AGG_ROUTER_CHAIN_CONFIG[chainId]?.address
    return address && address !== zeroAddress ? address : undefined
}

export function isAggRouterChain(chainId: number): boolean {
    return getAggRouterAddress(chainId) !== undefined
}

const HOP = {
    name: 'hops',
    type: 'tuple[]',
    components: [
        { name: 'factory', type: 'address' },
        { name: 'swapData', type: 'bytes' },
    ],
} as const

export const AGG_ROUTER_JUNOSWAP_ABI = [
    {
        type: 'function',
        name: 'aggregate',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'p',
                type: 'tuple',
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'minAmountOut', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                    { name: 'unwrapOut', type: 'bool' },
                    { name: 'referrer', type: 'address' },
                ],
            },
            {
                name: 'legs',
                type: 'tuple[]',
                components: [{ name: 'amountIn', type: 'uint256' }, HOP],
            },
        ],
        outputs: [{ name: 'amountOut', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'feeBps',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint16' }],
    },
    {
        type: 'function',
        name: 'factoryFeeBps',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint16' }],
    },
    {
        type: 'function',
        name: 'factoryKind',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        type: 'event',
        name: 'Aggregated',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'tokenIn', type: 'address', indexed: true },
            { name: 'tokenOut', type: 'address', indexed: true },
            { name: 'amountIn', type: 'uint256', indexed: false },
            { name: 'amountOut', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
            { name: 'legs', type: 'uint256', indexed: false },
            { name: 'referrer', type: 'address', indexed: false },
        ],
    },
] as const
