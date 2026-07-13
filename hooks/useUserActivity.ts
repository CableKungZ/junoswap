'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { ponderRequest, isPonderError } from '@/lib/ponder-client'
import { isLeaderboardSupportedChain } from '@/lib/leaderboard-utils'
import { isLaunchpadChain } from '@/lib/abis/bonding-curve-junoswap'
import { isAggRouterChain } from '@/lib/abis/agg-router-junoswap'
import { findTokenByAddress, getTokensForChain } from '@/lib/tokens'
import { findWrappedNativeAddress } from '@/services/tokens'
import { resolveLaunchpadLogo } from '@/lib/logo'
import { applyLaunchpadTokenOverride } from '@/lib/launchpad-token-config'
import type { ActivityEvent, ActivityLeg } from '@/types/portfolio'

const PAGE_SIZE = 20
const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

interface BondingCurvePage {
    swapEvents: {
        items: Array<{
            id: string
            tokenAddr: string
            sender: string
            isBuy: number
            amountIn: string
            amountOut: string
            timestamp: number
            transactionHash: string
        }>
    }
}

interface V3SwapPage {
    v3SwapEvents: {
        items: Array<{
            id: string
            tokenAddr: string
            sender: string
            txFrom: string
            tokenIsToken0: number
            amount0: string
            amount1: string
            timestamp: number
            transactionHash: string
            protocol: string
        }>
    }
}

interface V2SwapPage {
    v2SwapEvents: {
        items: Array<{
            id: string
            txFrom: string
            token0Addr: string
            token1Addr: string
            amount0In: string
            amount1In: string
            amount0Out: string
            amount1Out: string
            timestamp: number
            transactionHash: string
            protocol: string
        }>
    }
}

interface TransferPage {
    transferEvents: {
        items: Array<{
            id: string
            tokenAddr: string
            from: string
            to: string
            amount: string
            timestamp: number
            transactionHash: string
        }>
    }
}

interface AggSwapPage {
    aggSwapEvents: {
        items: Array<{
            id: string
            sender: string
            tokenIn: string
            tokenOut: string
            amountIn: string
            amountOut: string
            fee: string
            legs: number
            timestamp: number
            transactionHash: string
        }>
    }
}

interface TokenMetaPage {
    launchTokens: {
        items: Array<{
            tokenAddr: string
            logo: string
            name: string
            symbol: string
        }>
    }
}

interface V3TokenMetaPage {
    v3Tokens: {
        items: Array<{
            address: string
            symbol: string
            name: string
            decimals: number
        }>
    }
}

interface TokenMeta {
    symbol: string
    name: string
    logo: string
    decimals: number
}

async function fetchBondingCurveEvents(
    sender: string,
    chainId: number,
    limit: number,
    after?: string
): Promise<{ items: BondingCurvePage['swapEvents']['items']; totalCount: number }> {
    const query = `
        query UserBcActivity($sender: String!, $chainId: Int!, $limit: Int!, $after: String) {
            swapEvents(
                where: { sender: $sender, chainId: $chainId },
                orderBy: "timestamp",
                orderDirection: "desc",
                limit: $limit,
                after: $after
            ) {
                items {
                    id tokenAddr sender isBuy amountIn amountOut timestamp transactionHash
                }
            }
        }
    `
    const data = await ponderRequest<BondingCurvePage>(query, { sender, chainId, limit, after })
    const countQuery = `
        query UserBcCount($sender: String!, $chainId: Int!) {
            swapEvents(where: { sender: $sender, chainId: $chainId }, limit: 0) { items { id } }
        }
    `
    const countData = await ponderRequest<BondingCurvePage>(countQuery, {
        sender,
        chainId,
        limit: 0,
    })
    return {
        items: data.swapEvents.items,
        totalCount: countData.swapEvents.items.length,
    }
}

async function fetchV3Events(
    sender: string,
    chainId: number,
    limit: number,
    after?: string
): Promise<{ items: V3SwapPage['v3SwapEvents']['items']; totalCount: number }> {
    const query = `
        query UserV3Activity($sender: String!, $chainId: Int!, $limit: Int!, $after: String) {
            v3SwapEvents(
                where: { txFrom: $sender, chainId: $chainId },
                orderBy: "timestamp",
                orderDirection: "desc",
                limit: $limit,
                after: $after
            ) {
                items {
                    id tokenAddr sender txFrom tokenIsToken0 amount0 amount1 timestamp transactionHash protocol
                }
            }
        }
    `
    const data = await ponderRequest<V3SwapPage>(query, { sender, chainId, limit, after })
    const countQuery = `
        query UserV3Count($sender: String!, $chainId: Int!) {
            v3SwapEvents(where: { txFrom: $sender, chainId: $chainId }, limit: 0) { items { id } }
        }
    `
    const countData = await ponderRequest<V3SwapPage>(countQuery, {
        sender,
        chainId,
        limit: 0,
    })
    return {
        items: data.v3SwapEvents.items,
        totalCount: countData.v3SwapEvents.items.length,
    }
}

async function fetchV2Events(
    sender: string,
    chainId: number,
    limit: number,
    after?: string
): Promise<{ items: V2SwapPage['v2SwapEvents']['items']; totalCount: number }> {
    const query = `
        query UserV2Activity($sender: String!, $chainId: Int!, $limit: Int!, $after: String) {
            v2SwapEvents(
                where: { txFrom: $sender, chainId: $chainId },
                orderBy: "timestamp",
                orderDirection: "desc",
                limit: $limit,
                after: $after
            ) {
                items {
                    id txFrom token0Addr token1Addr amount0In amount1In amount0Out amount1Out timestamp transactionHash protocol
                }
            }
        }
    `
    const data = await ponderRequest<V2SwapPage>(query, { sender, chainId, limit, after })
    const countQuery = `
        query UserV2Count($sender: String!, $chainId: Int!) {
            v2SwapEvents(where: { txFrom: $sender, chainId: $chainId }, limit: 0) { items { id } }
        }
    `
    const countData = await ponderRequest<V2SwapPage>(countQuery, {
        sender,
        chainId,
        limit: 0,
    })
    return {
        items: data.v2SwapEvents.items,
        totalCount: countData.v2SwapEvents.items.length,
    }
}

async function fetchTransferEvents(
    sender: string,
    chainId: number,
    limit: number
): Promise<{ items: TransferPage['transferEvents']['items']; totalCount: number }> {
    const query = `
        query UserTransfers($sender: String!, $chainId: Int!, $limit: Int!) {
            transferEvents(
                where: { AND: [{ OR: [{ from: $sender }, { to: $sender }] }, { chainId: $chainId }] },
                orderBy: "timestamp",
                orderDirection: "desc",
                limit: $limit
            ) {
                items {
                    id tokenAddr from to amount timestamp transactionHash
                }
            }
        }
    `
    const data = await ponderRequest<TransferPage>(query, { sender, chainId, limit })
    const countQuery = `
        query UserTransferCount($sender: String!, $chainId: Int!) {
            transferEvents(where: { AND: [{ OR: [{ from: $sender }, { to: $sender }] }, { chainId: $chainId }] }, limit: 0) { items { id } }
        }
    `
    const countData = await ponderRequest<TransferPage>(countQuery, { sender, chainId })
    return {
        items: data.transferEvents.items,
        totalCount: countData.transferEvents.items.length,
    }
}

async function fetchAggEvents(
    sender: string,
    chainId: number,
    limit: number,
    after?: string
): Promise<{ items: AggSwapPage['aggSwapEvents']['items']; totalCount: number }> {
    const query = `
        query UserAggActivity($sender: String!, $chainId: Int!, $limit: Int!, $after: String) {
            aggSwapEvents(
                where: { sender: $sender, chainId: $chainId },
                orderBy: "timestamp",
                orderDirection: "desc",
                limit: $limit,
                after: $after
            ) {
                items {
                    id sender tokenIn tokenOut amountIn amountOut fee legs timestamp transactionHash
                }
            }
        }
    `
    const data = await ponderRequest<AggSwapPage>(query, { sender, chainId, limit, after })
    const countQuery = `
        query UserAggCount($sender: String!, $chainId: Int!) {
            aggSwapEvents(where: { sender: $sender, chainId: $chainId }, limit: 0) { items { id } }
        }
    `
    const countData = await ponderRequest<AggSwapPage>(countQuery, { sender, chainId, limit: 0 })
    return {
        items: data.aggSwapEvents.items,
        totalCount: countData.aggSwapEvents.items.length,
    }
}

async function fetchTokenMeta(chainId: number): Promise<Map<string, TokenMeta>> {
    const query = `
        query TokenMeta {
            launchTokens(limit: 1000) {
                items { tokenAddr logo name symbol }
            }
        }
    `
    const data = await ponderRequest<TokenMetaPage>(query, {})
    const map = new Map<string, TokenMeta>()
    for (const raw of data.launchTokens.items) {
        const t = applyLaunchpadTokenOverride(raw, chainId)
        map.set(t.tokenAddr.toLowerCase(), {
            symbol: t.symbol || '',
            name: t.name || '',
            logo: resolveLaunchpadLogo(t.logo),
            decimals: 18,
        })
    }
    return map
}

async function fetchV3TokenMeta(chainId: number): Promise<Map<string, TokenMeta>> {
    const query = `
        query V3TokenMeta($chainId: Int!) {
            v3Tokens(where: { chainId: $chainId }, limit: 500) {
                items { address symbol name decimals }
            }
        }
    `
    const data = await ponderRequest<V3TokenMetaPage>(query, { chainId })
    const map = new Map<string, TokenMeta>()
    for (const t of data.v3Tokens.items) {
        map.set(t.address.toLowerCase(), {
            symbol: t.symbol || '',
            name: t.name || '',
            logo: '',
            decimals: t.decimals ?? 18,
        })
    }
    return map
}

export function useUserActivity(
    address: Address | undefined,
    chainId: number,
    page: number = 1,
    typeFilter: 'all' | 'buy' | 'sell' = 'all'
) {
    const isSupportedChain = isLeaderboardSupportedChain(chainId)
    const hasLaunchpad = isLaunchpadChain(chainId)

    return useQuery({
        queryKey: ['user-activity', address, chainId, page, typeFilter],
        queryFn: async (): Promise<{ data: ActivityEvent[]; totalCount: number }> => {
            if (!address || !isSupportedChain) return { data: [], totalCount: 0 }

            const sender = address.toLowerCase()

            try {
                const [
                    launchMeta,
                    v3Meta,
                    bcResult,
                    v3Result,
                    v2Result,
                    transferResult,
                    aggResult,
                ] = await Promise.all([
                    hasLaunchpad
                        ? fetchTokenMeta(chainId)
                        : Promise.resolve(new Map<string, TokenMeta>()),
                    fetchV3TokenMeta(chainId),
                    hasLaunchpad
                        ? fetchBondingCurveEvents(sender, chainId, PAGE_SIZE + 50)
                        : Promise.resolve({ items: [], totalCount: 0 }),
                    fetchV3Events(sender, chainId, PAGE_SIZE + 50),
                    fetchV2Events(sender, chainId, PAGE_SIZE + 50),
                    hasLaunchpad
                        ? fetchTransferEvents(sender, chainId, PAGE_SIZE + 50)
                        : Promise.resolve({ items: [], totalCount: 0 }),
                    isAggRouterChain(chainId)
                        ? fetchAggEvents(sender, chainId, PAGE_SIZE + 50)
                        : Promise.resolve({ items: [], totalCount: 0 }),
                ])

                const tokenMeta = new Map(launchMeta)
                for (const t of getTokensForChain(chainId)) {
                    const addr = t.address.toLowerCase()
                    if (!tokenMeta.has(addr)) {
                        tokenMeta.set(addr, {
                            symbol: t.symbol,
                            name: t.name,
                            logo: resolveLaunchpadLogo(t.logo),
                            decimals: t.decimals ?? 18,
                        })
                    }
                }
                for (const [addr, meta] of v3Meta) {
                    if (!tokenMeta.has(addr)) tokenMeta.set(addr, meta)
                }

                const aggTxHashes = new Set(aggResult.items.map((e) => e.transactionHash))
                const bcItems = bcResult.items.filter((e) => !aggTxHashes.has(e.transactionHash))
                const v3Items = v3Result.items.filter((e) => !aggTxHashes.has(e.transactionHash))
                const v2Items = v2Result.items.filter((e) => !aggTxHashes.has(e.transactionHash))

                const wrappedNative = findWrappedNativeAddress(chainId)?.toLowerCase()
                const nativeToken = findTokenByAddress(chainId, NATIVE_ADDRESS)
                const nativeLegMeta = nativeToken
                    ? {
                          symbol: nativeToken.symbol,
                          logo: resolveLaunchpadLogo(nativeToken.logo),
                          decimals: nativeToken.decimals ?? 18,
                      }
                    : null
                const resolveAggLeg = (addr: string, amount: string): ActivityLeg => {
                    const a = addr.toLowerCase()
                    if (wrappedNative && a === wrappedNative && nativeLegMeta) {
                        return {
                            tokenAddr: a,
                            symbol: nativeLegMeta.symbol,
                            logo: nativeLegMeta.logo,
                            amount,
                            decimals: nativeLegMeta.decimals,
                        }
                    }
                    const m = tokenMeta.get(a)
                    return {
                        tokenAddr: a,
                        symbol: m?.symbol || a.slice(0, 6) + '…',
                        logo: m?.logo || '',
                        amount,
                        decimals: m?.decimals ?? 18,
                    }
                }

                const bcEvents: ActivityEvent[] = bcItems.map((e) => {
                    const meta = tokenMeta.get(e.tokenAddr.toLowerCase())
                    return {
                        kind: 'trade' as const,
                        id: e.id,
                        tokenAddr: e.tokenAddr.toLowerCase(),
                        tokenSymbol: meta?.symbol || e.tokenAddr.slice(0, 6) + '…',
                        tokenName: meta?.name || '',
                        tokenLogo: meta?.logo || '',
                        isBuy: e.isBuy === 1,
                        amountIn: e.amountIn,
                        amountOut: e.amountOut,
                        protocol: 'junoswap',
                        timestamp: e.timestamp,
                        transactionHash: e.transactionHash,
                        sender: e.sender,
                    }
                })

                const v3Events: ActivityEvent[] = v3Items.map((e) => {
                    const tokenIsToken0 = e.tokenIsToken0 === 1
                    const tokenAmt = BigInt(tokenIsToken0 ? e.amount0 : e.amount1)
                    const nativeAmt = BigInt(tokenIsToken0 ? e.amount1 : e.amount0)
                    const abs = (x: bigint) => (x < 0n ? -x : x)
                    const isBuy = tokenAmt < 0n // token leaves the pool => user receives it
                    const meta = tokenMeta.get(e.tokenAddr.toLowerCase())
                    return {
                        kind: 'trade' as const,
                        id: e.id,
                        tokenAddr: e.tokenAddr.toLowerCase(),
                        tokenSymbol: meta?.symbol || e.tokenAddr.slice(0, 6) + '…',
                        tokenName: meta?.name || '',
                        tokenLogo: meta?.logo || '',
                        isBuy,
                        amountIn: (isBuy ? abs(nativeAmt) : abs(tokenAmt)).toString(),
                        amountOut: (isBuy ? abs(tokenAmt) : abs(nativeAmt)).toString(),
                        protocol:
                            !e.protocol || e.protocol === 'junoswap' ? 'junoswap-amm' : e.protocol,
                        timestamp: e.timestamp,
                        transactionHash: e.transactionHash,
                        sender: e.txFrom,
                    }
                })

                const legMeta = (addr: string): ActivityLeg => {
                    const a = addr.toLowerCase()
                    const m = tokenMeta.get(a)
                    return {
                        tokenAddr: a,
                        symbol: m?.symbol || a.slice(0, 6) + '…',
                        logo: m?.logo || '',
                        amount: '0',
                        decimals: m?.decimals ?? 18,
                    }
                }
                const v2Events: ActivityEvent[] = v2Items.map((e) => {
                    const sellToken0 = BigInt(e.amount0In) > 0n
                    const soldAddr = sellToken0 ? e.token0Addr : e.token1Addr
                    const boughtAddr = sellToken0 ? e.token1Addr : e.token0Addr
                    const soldAmt = (sellToken0 ? e.amount0In : e.amount1In).toString()
                    const boughtAmt = (sellToken0 ? e.amount1Out : e.amount0Out).toString()
                    const sell = { ...legMeta(soldAddr), amount: soldAmt }
                    const buy = { ...legMeta(boughtAddr), amount: boughtAmt }
                    return {
                        kind: 'trade' as const,
                        id: e.id,
                        tokenAddr: buy.tokenAddr,
                        tokenSymbol: buy.symbol,
                        tokenName: '',
                        tokenLogo: buy.logo,
                        isBuy: true,
                        amountIn: soldAmt,
                        amountOut: boughtAmt,
                        protocol: e.protocol === 'junoswap' ? 'junoswap-amm' : e.protocol,
                        sell,
                        buy,
                        timestamp: e.timestamp,
                        transactionHash: e.transactionHash,
                        sender: e.txFrom,
                    }
                })

                const aggEvents: ActivityEvent[] = aggResult.items.map((e) => {
                    const sell = resolveAggLeg(e.tokenIn, e.amountIn)
                    const buy = resolveAggLeg(e.tokenOut, e.amountOut)
                    return {
                        kind: 'trade' as const,
                        id: e.id,
                        tokenAddr: buy.tokenAddr,
                        tokenSymbol: buy.symbol,
                        tokenName: '',
                        tokenLogo: buy.logo,
                        isBuy: true,
                        amountIn: e.amountIn,
                        amountOut: e.amountOut,
                        protocol: 'junoswap-aggregator',
                        sell,
                        buy,
                        timestamp: e.timestamp,
                        transactionHash: e.transactionHash,
                        sender: e.sender,
                    }
                })

                const swapTxHashes = new Set([
                    ...bcItems.map((e) => e.transactionHash),
                    ...v3Items.map((e) => e.transactionHash),
                    ...v2Items.map((e) => e.transactionHash),
                    ...aggTxHashes,
                ])

                const transferEvents: ActivityEvent[] = transferResult.items
                    .filter((e) => !swapTxHashes.has(e.transactionHash))
                    .map((e) => {
                        const isReceived = e.to.toLowerCase() === sender
                        const meta = tokenMeta.get(e.tokenAddr.toLowerCase())
                        return {
                            kind: 'transfer' as const,
                            id: e.id,
                            tokenAddr: e.tokenAddr.toLowerCase(),
                            tokenSymbol: meta?.symbol || e.tokenAddr.slice(0, 6) + '…',
                            tokenName: meta?.name || '',
                            tokenLogo: meta?.logo || '',
                            isBuy: false,
                            amountIn: '0',
                            amountOut: '0',
                            direction: isReceived ? ('in' as const) : ('out' as const),
                            counterparty: (isReceived ? e.from : e.to).toLowerCase(),
                            transferAmount: e.amount,
                            timestamp: e.timestamp,
                            transactionHash: e.transactionHash,
                            sender,
                        }
                    })

                let allEvents = [
                    ...bcEvents,
                    ...v3Events,
                    ...v2Events,
                    ...aggEvents,
                    ...transferEvents,
                ].sort((a, b) => b.timestamp - a.timestamp)

                if (typeFilter !== 'all') {
                    const isBuyFilter = typeFilter === 'buy'
                    allEvents = allEvents.filter(
                        (e) => e.kind === 'trade' && e.isBuy === isBuyFilter
                    )
                }

                const totalCount = allEvents.length
                const start = (page - 1) * PAGE_SIZE
                const data = allEvents.slice(start, start + PAGE_SIZE)

                return { data, totalCount }
            } catch (e) {
                if (isPonderError(e)) return { data: [], totalCount: 0 }
                throw e
            }
        },
        enabled: !!address && isSupportedChain,
        staleTime: 30_000,
        refetchInterval: 30_000,
    })
}
