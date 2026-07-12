import type { Token } from './tokens'
import type { LaunchToken } from './launchpad'

export type TokenType = 'static' | 'graduated' | 'bonding_curve'

export interface CreatedToken {
    token: LaunchToken
    marketCapNative: number
    creatorFeeNative: bigint
    creatorFeeClaimedNative: bigint
    creatorFeeToken: bigint
    creatorFeeClaimedToken: bigint
    /** display-only USD estimate for the token-denominated fee, from tokenSnapshot.lastPriceUsd */
    tokenUsdPrice: number
}

export interface PortfolioToken {
    token: Token
    balance: bigint
    formattedBalance: string
    priceUsd: number | null
    valueUsd: number
    pnlUsd: number | null
    pnlPercent: number | null
    tokenType: TokenType
}

export interface PortfolioSummary {
    netWorth: number
    totalPnl: number | null
    totalPnlPercent: number | null
}

export interface ActivityLeg {
    tokenAddr: string
    symbol: string
    logo: string
    amount: string
    decimals: number
}

export interface ActivityEvent {
    id: string
    kind: 'trade' | 'transfer'
    tokenAddr: string
    tokenSymbol: string
    tokenName: string
    tokenLogo: string
    isBuy: boolean
    amountIn: string
    amountOut: string
    sell?: ActivityLeg
    buy?: ActivityLeg
    protocol?: string
    direction?: 'in' | 'out'
    counterparty?: string
    transferAmount?: string
    timestamp: number
    transactionHash: string
    sender: string
}
