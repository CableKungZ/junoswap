export type DEXType = 'cmswap' | 'uniswap' | 'sushiswap' | 'pancakeswap' | string

export interface DEXMetadata {
    id: DEXType
    name: string
    displayName: string
    icon?: string
    description?: string
    website?: string
}

export const DEX_REGISTRY: Record<string, DEXMetadata> = {
    cmswap: {
        id: 'cmswap',
        name: 'cmswap',
        displayName: 'CMswap',
        icon: 'favicon.ico',
        description: 'Uniswap V3 DEX',
        website: 'https://cmswap.xyz',
    },
    uniswap: {
        id: 'uniswap',
        name: 'uniswap',
        displayName: 'Uniswap V3',
        description: 'Uniswap V3 DEX',
        website: 'https://uniswap.org',
    },
    jibswap: {
        id: 'jibswap',
        name: 'jibswap',
        displayName: 'Jibswap',
        description: 'Uniswap V2 DEX',
        website: 'https://jibswap.com',
    },
    commudao: {
        id: 'commudao',
        name: 'commudao',
        displayName: 'Commudao',
        description: 'Custom AMM',
    },
    udonswap: {
        id: 'udonswap',
        name: 'udonswap',
        displayName: 'UdonSwap',
        description: 'Uniswap V2 DEX',
        website: 'https://www.udonswap.io',
    },
    ponder: {
        id: 'ponder',
        name: 'ponder',
        displayName: 'Ponder Finance',
        description: 'Uniswap V2 DEX',
        website: 'https://www.ponder.finance',
    },
    diamon: {
        id: 'diamon',
        name: 'diamon',
        displayName: 'Diamon Finance',
        description: 'Uniswap V2 DEX',
        website: 'https://app.diamon.finance',
    },
    pancakeswap: {
        id: 'pancakeswap',
        name: 'pancakeswap',
        displayName: 'PancakeSwap V3',
        description: 'Uniswap V3 DEX',
        website: 'https://pancakeswap.finance',
    },
}
