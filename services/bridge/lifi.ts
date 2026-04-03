'use client'

import { getQuote, getRoutes, getStatus, executeRoute, convertQuoteToRoute } from '@lifi/sdk'
import type { RouteExtended } from '@lifi/sdk'
import type { LiFiStep, Route, RoutesRequest, StatusResponse } from '@lifi/types'
import type { Address } from 'viem'

export interface BridgeQuoteParams {
    fromChainId: number
    toChainId: number
    fromTokenAddress: string
    toTokenAddress: string
    fromAmount: string
    fromAddress: string
    slippage?: number
}

export interface BridgeRoutesParams {
    fromChainId: number
    toChainId: number
    fromTokenAddress: string
    toTokenAddress: string
    fromAmount: string
    fromAddress: string
    toAddress?: string
    slippage?: number
}

/**
 * Fetch a single bridge quote (fastest, returns one LiFiStep)
 */
export async function fetchBridgeQuote(params: BridgeQuoteParams): Promise<LiFiStep> {
    return getQuote({
        fromChain: params.fromChainId,
        toChain: params.toChainId,
        fromToken: params.fromTokenAddress,
        toToken: params.toTokenAddress,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        slippage: params.slippage ?? 0.03,
    })
}

/**
 * Fetch multiple bridge routes (returns ranked route options)
 */
export async function fetchBridgeRoutes(params: BridgeRoutesParams): Promise<Route[]> {
    const routesRequest: RoutesRequest = {
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress as Address,
        toAddress: params.toAddress as Address | undefined,
        options: {
            slippage: params.slippage ?? 0.03,
            order: 'RECOMMENDED',
        },
    }

    const response = await getRoutes(routesRequest)
    return response.routes
}

/**
 * Execute a bridge route
 * The LI.FI SDK handles the full lifecycle internally via the registered EVM provider
 */
export async function executeBridge(route: Route): Promise<RouteExtended> {
    return executeRoute(route)
}

/**
 * Get the status of a bridge transaction
 */
export async function getBridgeStatus(params: {
    txHash?: string
    taskId?: string
    bridge?: string
    fromChain?: number
    toChain?: number
}): Promise<StatusResponse> {
    return getStatus({
        ...params,
        fromAddress: params.fromChain?.toString(),
    } as Parameters<typeof getStatus>[0])
}

/**
 * Convert a quote (LiFiStep) into a Route for execution
 */
export async function quoteToRoute(quote: LiFiStep): Promise<Route> {
    return convertQuoteToRoute(quote)
}
