'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { isLaunchpadChain } from '@/lib/abis/bonding-curve-junoswap'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import { ponderRequest } from '@/lib/ponder-client'
import { mapLaunchTokenItem } from '@/services/launchpad'
import type { CreatedToken } from '@/types/portfolio'

const CREATED_TOKENS_QUERY = `
  query CreatedTokens($chainId: Int!, $creator: String!) {
    launchTokens(
      where: { chainId: $chainId, creator: $creator }
      orderBy: "createdTime"
      orderDirection: "desc"
      limit: 200
    ) {
      items {
        tokenAddr
        creator
        name
        symbol
        logo
        description
        link1
        link2
        link3
        createdTime
        isGraduated
        graduatedAt
      }
    }
  }
`

const SNAPSHOTS_QUERY = `
  query CreatedTokenSnapshots($chainId: Int!, $addrs: [String!]!) {
    tokenSnapshots(where: { chainId: $chainId, tokenAddr_in: $addrs }, limit: 200) {
      items {
        tokenAddr
        marketCapNative
        creatorFeeNative
        creatorFeeClaimedNative
        creatorFeeToken
        creatorFeeClaimedToken
        lastPriceUsd
      }
    }
  }
`

interface CreatedTokensResponse {
    launchTokens: {
        items: Array<{
            tokenAddr: string
            creator: string
            name: string
            symbol: string
            logo: string
            description: string
            link1: string
            link2: string
            link3: string
            createdTime: number
            isGraduated: number
            graduatedAt: number | null
        }>
    }
}

interface SnapshotsResponse {
    tokenSnapshots: {
        items: Array<{
            tokenAddr: string
            marketCapNative: string
            creatorFeeNative: string | null
            creatorFeeClaimedNative: string | null
            creatorFeeToken: string | null
            creatorFeeClaimedToken: string | null
            lastPriceUsd: string | null
        }>
    }
}

interface UseCreatedTokensResult {
    createdTokens: CreatedToken[]
    isLoading: boolean
}

export function useCreatedTokens(address: Address | undefined): UseCreatedTokensResult {
    const chainId = useLaunchpadChainId()
    const supported = isLaunchpadChain(chainId)

    const { data, isLoading } = useQuery({
        queryKey: ['created-tokens', chainId, address?.toLowerCase()],
        queryFn: async (): Promise<CreatedToken[]> => {
            const creator = address!.toLowerCase()
            const tokensData = await ponderRequest<CreatedTokensResponse>(CREATED_TOKENS_QUERY, {
                chainId,
                creator,
            })

            const items = tokensData.launchTokens.items
            if (items.length === 0) return []

            const snapshotsData = await ponderRequest<SnapshotsResponse>(SNAPSHOTS_QUERY, {
                chainId,
                addrs: items.map((t) => t.tokenAddr.toLowerCase()),
            })
            const snapshotMap = new Map(
                snapshotsData.tokenSnapshots.items.map((s) => [s.tokenAddr.toLowerCase(), s])
            )

            return items.map((t): CreatedToken => {
                const token = mapLaunchTokenItem(t, chainId)
                const snap = snapshotMap.get(t.tokenAddr.toLowerCase())
                return {
                    token,
                    marketCapNative: snap ? parseFloat(snap.marketCapNative) : 0,
                    creatorFeeNative: BigInt(snap?.creatorFeeNative ?? '0'),
                    creatorFeeClaimedNative: BigInt(snap?.creatorFeeClaimedNative ?? '0'),
                    creatorFeeToken: BigInt(snap?.creatorFeeToken ?? '0'),
                    creatorFeeClaimedToken: BigInt(snap?.creatorFeeClaimedToken ?? '0'),
                    tokenUsdPrice: parseFloat(snap?.lastPriceUsd ?? '0'),
                }
            })
        },
        staleTime: 30_000,
        enabled: supported && !!address,
    })

    return {
        createdTokens: data ?? [],
        isLoading: supported && !!address ? isLoading : false,
    }
}
