export const AGG_ROUTER_JUNOSWAP_BITKUB_ADDRESS =
    '0x532cbec4ADb30Aa4F474c9F71907901729e1917C' as const

export const AGG_ROUTER_JUNOSWAP_ABI = [
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

export type AggRouterJunoswapAbi = typeof AGG_ROUTER_JUNOSWAP_ABI
