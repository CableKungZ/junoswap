import type { Address } from 'viem'
import {
    fetchTokenBondingCurveSwaps,
    fetchTokenV3Swaps,
    fetchTokenHolders,
    fetchTokenSnapshots,
} from '@coshi190/juno-moneta-sdk'
import { ponderClient } from '@/lib/ponder-client'
import { INITIAL_TOKEN_SUPPLY } from '@/lib/launchpad-curve'
import { fetchDurianfunMarketSwaps, fetchDurianfunHolders } from './durianfun'
import type { HolderData, LaunchpadPlatform, SwapEventData } from '@/types/launchpad'

export interface SwapHistoryFilters {
    isBuy?: boolean // true = buys only, false = sells only, undefined = all
    sender?: string // lowercase hex address to filter by
}

export interface SwapHistoryParams {
    chainId: number
    tokenAddr: Address
    market?: Address
    isGraduated?: boolean
    page: number
    pageSize: number
    filters?: SwapHistoryFilters
}

export interface HoldersParams {
    tokenAddr: Address
    market?: Address
}

/**
 * A source of trade/holder data for one launchpad platform. Every platform-specific
 * "how do I get this data" branch belongs behind one of these, not inline in the hooks --
 * adding a third-party platform means writing a new adapter + one registry entry below,
 * not touching useTokenSwapEvents/useTokenHolders.
 */
export interface LaunchpadPlatformAdapter {
    fetchSwapHistory(
        params: SwapHistoryParams
    ): Promise<{ data: SwapEventData[]; totalCount: number }>
    fetchHolders(params: HoldersParams): Promise<{ holders: HolderData[]; holderCount: number }>
}

function absBigInt(n: bigint): bigint {
    return n < 0n ? -n : n
}

function toIsBuy(isBuy: boolean | undefined): number | undefined {
    return isBuy === undefined ? undefined : isBuy ? 1 : 0
}

// ponytail: balances come from the indexer (same source that decides who is a holder), so every
// holder is listed without an on-chain read per address. If indexer lag ever matters, verify the
// visible page on-chain instead of reintroducing a global scan limit.
/** Pure: raw {address, balance} rows -> ranked HolderData[]. Shared by every adapter below. */
export function toHolders(rows: { address: string; balance: string | bigint }[]): HolderData[] {
    const byAddress = new Map<string, bigint>()
    for (const row of rows) {
        const balance = BigInt(row.balance)
        if (balance > 0n) byAddress.set(row.address.toLowerCase(), balance)
    }

    return [...byAddress]
        .map(([address, balance]) => ({
            address: address as Address,
            balance,
            percentage:
                INITIAL_TOKEN_SUPPLY > 0n
                    ? Number((balance * 10000n) / INITIAL_TOKEN_SUPPLY) / 100
                    : 0,
        }))
        .sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
}

/**
 * Junoswap's ponder index. Also serves ANY graduated token regardless of platform -- the
 * v3-swap/holder tables are keyed by token address, not by factory, so a Durianfun token that
 * graduated onto Kublerx is already picked up here without a Durianfun-specific read (verified
 * against a real graduated token: its post-graduation trades showed up correctly).
 *
 * TODO: refactor indexing to go through @coshi190/juno-moneta-sdk end-to-end once it exposes a
 * generic third-party/bonding-curve read -- durianfunAdapter below would then drop its raw
 * getLogs calls in favor of the SDK, without any change outside this file.
 */
const ponderAdapter: LaunchpadPlatformAdapter = {
    async fetchSwapHistory({ chainId, tokenAddr, isGraduated, page, pageSize, filters }) {
        const offset = (page - 1) * pageSize

        if (isGraduated) {
            const [bcResult, v3Result] = await Promise.all([
                fetchTokenBondingCurveSwaps(ponderClient, {
                    tokenAddr: tokenAddr.toLowerCase(),
                    limit: 1000,
                    offset: 0,
                    isBuy: toIsBuy(filters?.isBuy),
                    sender: filters?.sender?.toLowerCase(),
                }),
                fetchTokenV3Swaps(ponderClient, {
                    tokenAddr: tokenAddr.toLowerCase(),
                    chainId,
                    limit: pageSize,
                    offset,
                    txFrom: filters?.sender?.toLowerCase(),
                }),
            ])

            const bcItems = bcResult.items.map((e) => ({
                blockNumber: BigInt(e.blockNumber),
                timestamp: e.timestamp,
                sender: e.sender as Address,
                isBuy: e.isBuy === 1,
                tokenAddr,
                amountIn: BigInt(e.amountIn),
                amountOut: BigInt(e.amountOut),
                reserveIn: BigInt(e.reserveIn),
                reserveOut: BigInt(e.reserveOut),
                transactionHash: e.transactionHash as `0x${string}`,
            }))

            let v3Items = v3Result.items.map((e) => {
                const amount0 = BigInt(e.amount0)
                const amount1 = BigInt(e.amount1)

                const tokenIsToken0 = e.tokenIsToken0 === 1
                const tokenAmount = tokenIsToken0 ? amount0 : amount1
                const nativeAmount = tokenIsToken0 ? amount1 : amount0

                const isBuy = tokenAmount < 0n

                return {
                    blockNumber: BigInt(e.blockNumber),
                    timestamp: e.timestamp,
                    sender: e.txFrom as Address, // actual signer, not the router
                    isBuy,
                    tokenAddr,
                    amountIn: absBigInt(isBuy ? nativeAmount : tokenAmount),
                    amountOut: absBigInt(isBuy ? tokenAmount : nativeAmount),
                    reserveIn: 0n,
                    reserveOut: 0n,
                    transactionHash: e.transactionHash as `0x${string}`,
                }
            })

            if (filters?.isBuy !== undefined) {
                v3Items = v3Items.filter((item) => item.isBuy === filters.isBuy)
            }

            const nv3 = v3Result.totalCount
            const bcStart = Math.max(0, offset - nv3)
            const bcNeeded = pageSize - v3Items.length
            const bcInWindow = bcNeeded > 0 ? bcItems.slice(bcStart, bcStart + bcNeeded) : []
            const data = [...v3Items, ...bcInWindow]
            const totalCount = nv3 + bcItems.length

            return { data, totalCount }
        }

        const result = await fetchTokenBondingCurveSwaps(ponderClient, {
            tokenAddr: tokenAddr.toLowerCase(),
            limit: pageSize,
            offset,
            isBuy: toIsBuy(filters?.isBuy),
            sender: filters?.sender?.toLowerCase(),
        })

        const data = result.items.map((e) => ({
            blockNumber: BigInt(e.blockNumber),
            timestamp: e.timestamp,
            sender: e.sender as Address,
            isBuy: e.isBuy === 1,
            tokenAddr,
            amountIn: BigInt(e.amountIn),
            amountOut: BigInt(e.amountOut),
            reserveIn: BigInt(e.reserveIn),
            reserveOut: BigInt(e.reserveOut),
            transactionHash: e.transactionHash as `0x${string}`,
        }))

        return { data, totalCount: result.totalCount }
    },

    async fetchHolders({ tokenAddr }) {
        const [rows, snapshots] = await Promise.all([
            fetchTokenHolders(ponderClient, { tokenAddr }, ['address', 'balance'] as const),
            fetchTokenSnapshots(ponderClient, { tokenAddrs: [tokenAddr] }, [
                'holderCount',
            ] as const),
        ])

        const holders = toHolders(rows)
        const holderCount = Math.max(snapshots[0]?.holderCount ?? 0, holders.length)
        return { holders, holderCount }
    },
}

/**
 * Non-graduated Durianfun tokens trade on their own per-token market contract, which isn't
 * indexed anywhere else -- everything here reads straight from chain (see durianfun.ts).
 */
const durianfunAdapter: LaunchpadPlatformAdapter = {
    async fetchSwapHistory({ tokenAddr, market, page, pageSize, filters }) {
        if (!market) return { data: [], totalCount: 0 }

        const swaps = await fetchDurianfunMarketSwaps(market)
        const filtered = swaps.filter((s) => {
            if (filters?.isBuy !== undefined && s.isBuy !== filters.isBuy) return false
            if (filters?.sender && s.sender.toLowerCase() !== filters.sender.toLowerCase())
                return false
            return true
        })

        const offset = (page - 1) * pageSize
        const data: SwapEventData[] = filtered.slice(offset, offset + pageSize).map((s) => ({
            blockNumber: s.blockNumber,
            timestamp: s.timestamp,
            sender: s.sender,
            isBuy: s.isBuy,
            tokenAddr,
            amountIn: s.amountIn,
            amountOut: s.amountOut,
            reserveIn: 0n,
            reserveOut: 0n,
            transactionHash: s.transactionHash,
        }))

        return { data, totalCount: filtered.length }
    },

    async fetchHolders({ tokenAddr, market }) {
        if (!market) return { holders: [], holderCount: 0 }
        const rows = await fetchDurianfunHolders(tokenAddr, market)
        const holders = toHolders(rows)
        return { holders, holderCount: holders.length }
    },
}

// Third-party platforms that need their own on-chain adapter while NOT graduated (a graduated
// token of any platform falls through to ponderAdapter above). Add a new platform here --
// nothing else in the data-fetching layer needs to change.
const THIRD_PARTY_ADAPTERS: Partial<Record<LaunchpadPlatform, LaunchpadPlatformAdapter>> = {
    durianfun: durianfunAdapter,
}

/** Picks the right data source for a token: registered on-chain reads while non-graduated, or
 *  the shared ponder index otherwise (Junoswap's own tokens always use the latter). */
export function resolvePlatformAdapter(
    platform: LaunchpadPlatform | undefined,
    isGraduated: boolean | undefined,
    market: Address | undefined
): LaunchpadPlatformAdapter {
    if (!isGraduated && market && platform) {
        const adapter = THIRD_PARTY_ADAPTERS[platform]
        if (adapter) return adapter
    }
    return ponderAdapter
}
