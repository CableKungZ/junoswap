'use client'

import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import type { Address } from 'viem'
import { PUMP_CORE_NATIVE_ADDRESS, PUMP_CORE_NATIVE_CHAIN_ID } from '@/lib/abis/pump-core-native'
import type { LaunchToken } from '@/types/launchpad'

const CREATION_EVENT = parseAbiItem(
    'event Creation(address indexed creator, address tokenAddr, string logo, string description, string link1, string link2, string link3, uint256 createdTime)'
)

// Block number where PumpCoreNative was deployed on KUB Testnet
// Update this after deployment if known, or use 0 to scan from genesis
const DEPLOYMENT_BLOCK = 0n

interface UseTokenListResult {
    tokens: LaunchToken[]
    isLoading: boolean
    refetch: () => void
}

export function useTokenList(): UseTokenListResult {
    const publicClient = usePublicClient({ chainId: PUMP_CORE_NATIVE_CHAIN_ID })

    const {
        data: tokens = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['launchpad-token-list', PUMP_CORE_NATIVE_CHAIN_ID],
        queryFn: async () => {
            if (!publicClient) return []

            const logs = await publicClient.getLogs({
                address: PUMP_CORE_NATIVE_ADDRESS,
                event: CREATION_EVENT,
                fromBlock: DEPLOYMENT_BLOCK,
                toBlock: 'latest',
            })

            const parsedTokens: LaunchToken[] = logs.map((log) => ({
                address: log.args.tokenAddr as Address,
                name: '', // Not in event, read from contract
                symbol: '', // Not in event, read from contract
                logo: log.args.logo ?? '',
                description: log.args.description ?? '',
                link1: log.args.link1 ?? '',
                link2: log.args.link2 ?? '',
                link3: log.args.link3 ?? '',
                creator: log.args.creator as Address,
                createdTime: Number(log.args.createdTime ?? 0),
                chainId: PUMP_CORE_NATIVE_CHAIN_ID,
            }))

            // Sort newest first
            parsedTokens.sort((a, b) => b.createdTime - a.createdTime)
            return parsedTokens
        },
        enabled: !!publicClient,
        staleTime: 30_000, // 30 seconds
    })

    return { tokens, isLoading, refetch }
}
