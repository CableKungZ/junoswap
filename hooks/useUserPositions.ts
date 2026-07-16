'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReadContract, useReadContracts, useChainId } from 'wagmi'
import type { Address } from 'viem'
import type { V3Position, PositionWithTokens, PositionDetails } from '@/types/earn'
import {
    getV3Config,
    getV3StakerAddress,
    fetchUserPositions,
    fetchPositionsByTokenIds,
    type V3PositionRow,
    NONFUNGIBLE_POSITION_MANAGER_ABI,
    UNISWAP_V3_FACTORY_ABI,
    UNISWAP_V3_POOL_ABI,
} from '@coshi190/junoswap-sdk'
import type { Token } from '@/types/token'
import { TOKEN_LISTS } from '@/lib/tokens'
import { ponderClient, isPonderError } from '@/lib/ponder-client'
import { useGraduatedTokens } from '@/hooks/useGraduatedTokens'
import { usePositionFees } from '@/hooks/usePositionFees'
import {
    isInRange,
    tickToSqrtPriceX96,
    getAmountsForLiquidity,
    sqrtPriceX96ToPrice,
    tickToPrice,
} from '@/lib/liquidity-helpers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

function buildTokenMap(chainId: number, graduatedTokens: Token[]): Map<string, Token> {
    const map = new Map<string, Token>()
    const staticTokens = TOKEN_LISTS[chainId] ?? []
    for (const t of staticTokens) {
        map.set(t.address.toLowerCase(), t)
    }
    for (const t of graduatedTokens) {
        if (!map.has(t.address.toLowerCase())) {
            map.set(t.address.toLowerCase(), t)
        }
    }
    return map
}

function createPlaceholderToken(address: Address, chainId: number): Token {
    return {
        address,
        symbol: `${address.slice(0, 6)}...`,
        name: 'Unknown Token',
        decimals: 18,
        chainId,
    }
}

function rowToV3Position(row: V3PositionRow): V3Position {
    return {
        tokenId: BigInt(row.tokenId),
        nonce: 0n,
        operator: ZERO_ADDRESS,
        token0: row.token0 as Address,
        token1: row.token1 as Address,
        fee: row.fee,
        tickLower: row.tickLower,
        tickUpper: row.tickUpper,
        liquidity: BigInt(row.liquidity),
        feeGrowthInside0LastX128: 0n,
        feeGrowthInside1LastX128: 0n,
        tokensOwed0: BigInt(row.tokensOwed0),
        tokensOwed1: BigInt(row.tokensOwed1),
    }
}

export function useUserPositions(
    owner: Address | undefined,
    chainId?: number
): {
    positions: PositionWithTokens[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
} {
    const currentChainId = useChainId()
    const effectiveChainId = chainId ?? currentChainId
    const dexConfig = getV3Config(effectiveChainId)
    const { tokens: graduatedTokens } = useGraduatedTokens(effectiveChainId)
    const tokenMap = useMemo(
        () => buildTokenMap(effectiveChainId, graduatedTokens),
        [effectiveChainId, graduatedTokens]
    )
    const {
        data: rowData,
        isLoading: isLoadingPositions,
        refetch: refetchPositionsData,
    } = useQuery({
        queryKey: ['user-positions', effectiveChainId, owner?.toLowerCase()],
        queryFn: async () => {
            try {
                return await fetchUserPositions(ponderClient, {
                    chainId: effectiveChainId,
                    owner: owner!,
                })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: !!owner,
        staleTime: 30_000,
    })
    const rawPositions = useMemo<V3Position[]>(
        () => (rowData ?? []).map(rowToV3Position),
        [rowData]
    )
    const {
        feesMap,
        isLoading: isLoadingFees,
        refetch: refetchFees,
    } = usePositionFees(rawPositions, owner, effectiveChainId)
    const uniquePoolKeys = useMemo(() => {
        const keys = new Set<string>()
        rawPositions.forEach((p) => {
            keys.add(`${p.token0}-${p.token1}-${p.fee}`)
        })
        return Array.from(keys).map((key) => {
            const [token0, token1, fee] = key.split('-')
            return { token0: token0 as Address, token1: token1 as Address, fee: parseInt(fee!) }
        })
    }, [rawPositions])
    const {
        data: poolAddresses,
        isLoading: isLoadingPoolAddresses,
        refetch: refetchPoolAddresses,
    } = useReadContracts({
        contracts: uniquePoolKeys.map(({ token0, token1, fee }) => ({
            address: dexConfig?.factory as Address,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: 'getPool',
            args: [token0, token1, fee],
            chainId: effectiveChainId,
        })),
        query: {
            enabled: uniquePoolKeys.length > 0 && !!dexConfig,
            staleTime: 60_000,
        },
    })
    const poolAddressList = useMemo(() => {
        if (!poolAddresses) return []
        return poolAddresses
            .map((r) => r.result as Address | undefined)
            .filter((a): a is Address => !!a && a !== '0x0000000000000000000000000000000000000000')
    }, [poolAddresses])
    const {
        data: poolStates,
        isLoading: isLoadingPoolStates,
        refetch: refetchPoolStates,
    } = useReadContracts({
        contracts: poolAddressList.map((poolAddress) => ({
            address: poolAddress,
            abi: UNISWAP_V3_POOL_ABI,
            functionName: 'slot0',
            chainId: effectiveChainId,
        })),
        query: {
            enabled: poolAddressList.length > 0,
            staleTime: 10_000,
        },
    })
    const poolStateMap = useMemo(() => {
        const map = new Map<string, { sqrtPriceX96: bigint; tick: number }>()
        if (!poolStates || !poolAddresses) return map
        uniquePoolKeys.forEach((key, index) => {
            const poolAddress = poolAddresses[index]?.result as Address | undefined
            if (!poolAddress) return
            const poolIndex = poolAddressList.indexOf(poolAddress)
            if (poolIndex === -1) return
            const slot0 = poolStates[poolIndex]?.result as
                | [bigint, number, number, number, number, number, boolean]
                | undefined
            if (!slot0) return
            const mapKey = `${key.token0}-${key.token1}-${key.fee}`
            map.set(mapKey, { sqrtPriceX96: slot0[0], tick: slot0[1] })
        })
        return map
    }, [poolStates, poolAddresses, poolAddressList, uniquePoolKeys])
    const positions = useMemo<PositionWithTokens[]>(() => {
        return rawPositions.map((position) => {
            const token0Info =
                tokenMap.get(position.token0.toLowerCase()) ??
                createPlaceholderToken(position.token0, effectiveChainId)
            const token1Info =
                tokenMap.get(position.token1.toLowerCase()) ??
                createPlaceholderToken(position.token1, effectiveChainId)
            const poolKey = `${position.token0}-${position.token1}-${position.fee}`
            const poolState = poolStateMap.get(poolKey)
            let amount0 = 0n
            let amount1 = 0n
            let currentTick = position.tickLower // fallback
            if (poolState) {
                const sqrtPriceAX96 = tickToSqrtPriceX96(position.tickLower)
                const sqrtPriceBX96 = tickToSqrtPriceX96(position.tickUpper)
                const amounts = getAmountsForLiquidity(
                    poolState.sqrtPriceX96,
                    sqrtPriceAX96,
                    sqrtPriceBX96,
                    position.liquidity
                )
                amount0 = amounts.amount0
                amount1 = amounts.amount1
                currentTick = poolState.tick
            }
            const poolAddress = poolAddresses?.[
                uniquePoolKeys.findIndex((k) => `${k.token0}-${k.token1}-${k.fee}` === poolKey)
            ]?.result as Address | undefined
            const fees = feesMap.get(position.tokenId.toString())
            return {
                ...position,
                token0Info,
                token1Info,
                poolAddress:
                    poolAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
                inRange: isInRange(currentTick, position.tickLower, position.tickUpper),
                currentTick,
                amount0,
                amount1,
                uncollectedFees0: fees?.fees0 ?? position.tokensOwed0,
                uncollectedFees1: fees?.fees1 ?? position.tokensOwed1,
            }
        })
    }, [
        rawPositions,
        effectiveChainId,
        tokenMap,
        poolStateMap,
        poolAddresses,
        uniquePoolKeys,
        feesMap,
    ])
    const refetch = () => {
        refetchPositionsData()
        refetchPoolAddresses()
        refetchPoolStates()
        refetchFees()
    }
    return {
        positions,
        isLoading:
            isLoadingPositions || isLoadingPoolAddresses || isLoadingPoolStates || isLoadingFees,
        isError: false,
        refetch,
    }
}

export function usePositionDetails(
    tokenId: bigint | undefined,
    chainId?: number
): {
    position: PositionDetails | null
    isLoading: boolean
    refetch: () => void
} {
    const currentChainId = useChainId()
    const effectiveChainId = chainId ?? currentChainId
    const dexConfig = getV3Config(effectiveChainId)
    const positionManager = dexConfig?.positionManager
    const isEnabled = tokenId !== undefined && !!positionManager
    const { tokens: graduatedTokens } = useGraduatedTokens(effectiveChainId)
    const tokenMap = useMemo(
        () => buildTokenMap(effectiveChainId, graduatedTokens),
        [effectiveChainId, graduatedTokens]
    )
    const {
        data: rowData,
        isLoading: isLoadingIndexer,
        refetch: refetchIndexer,
    } = useQuery({
        queryKey: ['position-detail', effectiveChainId, tokenId?.toString()],
        queryFn: async () => {
            try {
                return await fetchPositionsByTokenIds(ponderClient, {
                    chainId: effectiveChainId,
                    tokenIds: [tokenId!],
                })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: tokenId !== undefined,
        staleTime: 10_000,
    })
    const indexerRow = rowData?.[0]
    const needsFallback = isEnabled && !isLoadingIndexer && !indexerRow
    const {
        data: positionData,
        isLoading: isLoadingFallback,
        refetch: refetchFallback,
    } = useReadContract({
        address: positionManager,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: 'positions',
        args: needsFallback ? [tokenId!] : undefined,
        chainId: effectiveChainId,
        query: {
            enabled: needsFallback,
            staleTime: 10_000,
        },
    })
    const rawPosition = useMemo<V3Position | null>(() => {
        if (tokenId === undefined) return null
        if (indexerRow) return rowToV3Position(indexerRow)
        if (!positionData) return null
        const [
            nonce,
            operator,
            token0,
            token1,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1,
        ] = positionData
        return {
            tokenId,
            nonce,
            operator,
            token0,
            token1,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1,
        }
    }, [indexerRow, positionData, tokenId])
    const { data: poolAddress, isLoading: isLoadingPoolAddress } = useReadContract({
        address: dexConfig?.factory,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: 'getPool',
        args: rawPosition ? [rawPosition.token0, rawPosition.token1, rawPosition.fee] : undefined,
        chainId: effectiveChainId,
        query: {
            enabled: !!rawPosition,
            staleTime: 60_000,
        },
    })
    const { data: poolState, isLoading: isLoadingPoolState } = useReadContracts({
        contracts: poolAddress
            ? [
                  {
                      address: poolAddress as Address,
                      abi: UNISWAP_V3_POOL_ABI,
                      functionName: 'slot0',
                      chainId: effectiveChainId,
                  },
                  {
                      address: poolAddress as Address,
                      abi: UNISWAP_V3_POOL_ABI,
                      functionName: 'liquidity',
                      chainId: effectiveChainId,
                  },
              ]
            : [],
        query: {
            enabled: !!poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000',
            staleTime: 10_000,
        },
    })
    const position = useMemo<PositionDetails | null>(() => {
        if (!rawPosition) return null
        const token0Info =
            tokenMap.get(rawPosition.token0.toLowerCase()) ??
            createPlaceholderToken(rawPosition.token0, effectiveChainId)
        const token1Info =
            tokenMap.get(rawPosition.token1.toLowerCase()) ??
            createPlaceholderToken(rawPosition.token1, effectiveChainId)
        const slot0 = poolState?.[0]?.result as
            | [bigint, number, number, number, number, number, boolean]
            | undefined
        const poolLiquidity = poolState?.[1]?.result as bigint | undefined
        const sqrtPriceX96 = slot0?.[0] ?? 0n
        const currentTick = slot0?.[1] ?? rawPosition.tickLower
        const sqrtPriceAX96 = tickToSqrtPriceX96(rawPosition.tickLower)
        const sqrtPriceBX96 = tickToSqrtPriceX96(rawPosition.tickUpper)
        const { amount0, amount1 } = getAmountsForLiquidity(
            sqrtPriceX96,
            sqrtPriceAX96,
            sqrtPriceBX96,
            rawPosition.liquidity
        )
        const priceLower = tickToPrice(
            rawPosition.tickLower,
            token0Info.decimals,
            token1Info.decimals
        )
        const priceUpper = tickToPrice(
            rawPosition.tickUpper,
            token0Info.decimals,
            token1Info.decimals
        )
        const currentPrice =
            sqrtPriceX96 > 0n
                ? sqrtPriceX96ToPrice(sqrtPriceX96, token0Info.decimals, token1Info.decimals)
                : '0'
        return {
            ...rawPosition,
            token0Info,
            token1Info,
            poolAddress:
                (poolAddress as Address) ??
                ('0x0000000000000000000000000000000000000000' as Address),
            inRange: isInRange(currentTick, rawPosition.tickLower, rawPosition.tickUpper),
            amount0,
            amount1,
            uncollectedFees0: rawPosition.tokensOwed0,
            uncollectedFees1: rawPosition.tokensOwed1,
            currentTick,
            sqrtPriceX96,
            poolLiquidity: poolLiquidity ?? 0n,
            priceLower,
            priceUpper,
            currentPrice,
        }
    }, [rawPosition, effectiveChainId, tokenMap, poolState, poolAddress])
    const refetch = () => {
        refetchIndexer()
        refetchFallback()
    }
    return {
        position,
        isLoading:
            isLoadingIndexer || isLoadingFallback || isLoadingPoolAddress || isLoadingPoolState,
        refetch,
    }
}

export function usePositionsByTokenIds(
    tokenIds: bigint[],
    chainId?: number
): {
    positions: PositionWithTokens[]
    isLoading: boolean
    refetch: () => void
} {
    const currentChainId = useChainId()
    const effectiveChainId = chainId ?? currentChainId
    const dexConfig = getV3Config(effectiveChainId)
    const { tokens: graduatedTokens } = useGraduatedTokens(effectiveChainId)
    const tokenMap = useMemo(
        () => buildTokenMap(effectiveChainId, graduatedTokens),
        [effectiveChainId, graduatedTokens]
    )
    const tokenIdKey = useMemo(() => tokenIds.map(String), [tokenIds])
    const {
        data: rowData,
        isLoading: isLoadingPositions,
        refetch: refetchPositions,
    } = useQuery({
        queryKey: ['positions-by-ids', effectiveChainId, tokenIdKey],
        queryFn: async () => {
            try {
                return await fetchPositionsByTokenIds(ponderClient, {
                    chainId: effectiveChainId,
                    tokenIds,
                })
            } catch (e) {
                if (isPonderError(e)) return []
                throw e
            }
        },
        enabled: tokenIds.length > 0,
        staleTime: 10_000,
    })
    const rawPositions = useMemo<V3Position[]>(
        () => (rowData ?? []).map(rowToV3Position),
        [rowData]
    )
    const stakerAddress = getV3StakerAddress(effectiveChainId)
    const {
        feesMap,
        isLoading: isLoadingFees,
        refetch: refetchFees,
    } = usePositionFees(rawPositions, stakerAddress, effectiveChainId)
    const uniquePoolKeys = useMemo(() => {
        const keys = new Set<string>()
        rawPositions.forEach((p) => {
            keys.add(`${p.token0}-${p.token1}-${p.fee}`)
        })
        return Array.from(keys).map((key) => {
            const [token0, token1, fee] = key.split('-')
            return { token0: token0 as Address, token1: token1 as Address, fee: parseInt(fee!) }
        })
    }, [rawPositions])
    const {
        data: poolAddresses,
        isLoading: isLoadingPoolAddresses,
        refetch: refetchPoolAddresses,
    } = useReadContracts({
        contracts: uniquePoolKeys.map(({ token0, token1, fee }) => ({
            address: dexConfig?.factory as Address,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: 'getPool' as const,
            args: [token0, token1, fee] as const,
            chainId: effectiveChainId,
        })),
        query: {
            enabled: uniquePoolKeys.length > 0 && !!dexConfig,
            staleTime: 60_000,
        },
    })
    const poolAddressList = useMemo(() => {
        if (!poolAddresses) return []
        return poolAddresses
            .map((r) => r.result as Address | undefined)
            .filter((a): a is Address => !!a && a !== '0x0000000000000000000000000000000000000000')
    }, [poolAddresses])
    const {
        data: poolStates,
        isLoading: isLoadingPoolStates,
        refetch: refetchPoolStates,
    } = useReadContracts({
        contracts: poolAddressList.map((poolAddress) => ({
            address: poolAddress,
            abi: UNISWAP_V3_POOL_ABI,
            functionName: 'slot0' as const,
            chainId: effectiveChainId,
        })),
        query: {
            enabled: poolAddressList.length > 0,
            staleTime: 10_000,
        },
    })
    const poolStateMap = useMemo(() => {
        const map = new Map<string, { sqrtPriceX96: bigint; tick: number }>()
        if (!poolStates || !poolAddresses) return map
        uniquePoolKeys.forEach((key, index) => {
            const poolAddress = poolAddresses[index]?.result as Address | undefined
            if (!poolAddress) return
            const poolIndex = poolAddressList.indexOf(poolAddress)
            if (poolIndex === -1) return
            const slot0 = poolStates[poolIndex]?.result as
                | [bigint, number, number, number, number, number, boolean]
                | undefined
            if (!slot0) return
            const mapKey = `${key.token0}-${key.token1}-${key.fee}`
            map.set(mapKey, { sqrtPriceX96: slot0[0], tick: slot0[1] })
        })
        return map
    }, [poolStates, poolAddresses, poolAddressList, uniquePoolKeys])
    const positions = useMemo<PositionWithTokens[]>(() => {
        return rawPositions.map((position) => {
            const token0Info =
                tokenMap.get(position.token0.toLowerCase()) ??
                createPlaceholderToken(position.token0, effectiveChainId)
            const token1Info =
                tokenMap.get(position.token1.toLowerCase()) ??
                createPlaceholderToken(position.token1, effectiveChainId)
            const poolKey = `${position.token0}-${position.token1}-${position.fee}`
            const poolState = poolStateMap.get(poolKey)
            let amount0 = 0n
            let amount1 = 0n
            let currentTick = position.tickLower // fallback
            if (poolState) {
                const sqrtPriceAX96 = tickToSqrtPriceX96(position.tickLower)
                const sqrtPriceBX96 = tickToSqrtPriceX96(position.tickUpper)
                const amounts = getAmountsForLiquidity(
                    poolState.sqrtPriceX96,
                    sqrtPriceAX96,
                    sqrtPriceBX96,
                    position.liquidity
                )
                amount0 = amounts.amount0
                amount1 = amounts.amount1
                currentTick = poolState.tick
            }
            const poolAddress = poolAddresses?.[
                uniquePoolKeys.findIndex((k) => `${k.token0}-${k.token1}-${k.fee}` === poolKey)
            ]?.result as Address | undefined
            return {
                ...position,
                token0Info,
                token1Info,
                poolAddress:
                    poolAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
                inRange: isInRange(currentTick, position.tickLower, position.tickUpper),
                currentTick,
                amount0,
                amount1,
                uncollectedFees0:
                    feesMap.get(position.tokenId.toString())?.fees0 ?? position.tokensOwed0,
                uncollectedFees1:
                    feesMap.get(position.tokenId.toString())?.fees1 ?? position.tokensOwed1,
            }
        })
    }, [
        rawPositions,
        effectiveChainId,
        tokenMap,
        poolStateMap,
        poolAddresses,
        uniquePoolKeys,
        feesMap,
    ])
    const refetch = () => {
        refetchPositions()
        refetchPoolAddresses()
        refetchPoolStates()
        refetchFees()
    }
    return {
        positions,
        isLoading:
            isLoadingPositions || isLoadingPoolAddresses || isLoadingPoolStates || isLoadingFees,
        refetch,
    }
}
