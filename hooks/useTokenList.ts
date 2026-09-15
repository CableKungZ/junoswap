'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchLaunchTokens, fetchTokenSnapshots } from '@coshi190/juno-moneta-sdk'
import { getBondingCurveDeployment } from '@/lib/deployments'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import { ponderClient } from '@/lib/ponder-client'
import { LAUNCH_TOKEN_DETAIL_FIELDS } from '@/lib/ponder-fields'
import { bitkub } from '@/lib/wagmi'
import { mapLaunchTokenItem } from '@/services/launchpad/launchpad'
import {
    fetchDurianfunTokens,
    fetchDurianfunGraduationStatus,
    fetchDurianfunLogos,
    fetchGraduatedTokenPrices,
    toLaunchpadEntry,
    type DurianfunToken,
} from '@/services/launchpad/durianfun'
import type { LaunchToken } from '@/types/launchpad'

const SNAPSHOT_LIST_FIELDS = [
    'tokenAddr',
    'lastSwapAt',
    'marketCapNative',
    'athMarketCapNative',
    'lastPrice',
    'price1dAgoTimestamp',
    'priceChange1dPct',
] as const

const STALENESS_TOLERANCE = 3600 // 1 hour — hide badge if reference price is >1h before the 24h mark

interface SnapshotData {
    lastSwapAt: number
    marketCapNative: string
    athMarketCapNative: string
    lastPrice: string
    priceChange1dPct: number | null
}

interface UseTokenListResult {
    tokens: LaunchToken[]
    snapshotMap: Map<string, SnapshotData>
    isLoading: boolean
    refetch: () => void
}

export function useTokenList(): UseTokenListResult {
    const chainId = useLaunchpadChainId()
    const supported = getBondingCurveDeployment(chainId) !== undefined
    const durianfunEnabled = chainId === bitkub.id

    const {
        data: result,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['launchpad-token-list', chainId],
        queryFn: async () => {
            const [rows, snapshots] = await Promise.all([
                fetchLaunchTokens(ponderClient, { chainId }, LAUNCH_TOKEN_DETAIL_FIELDS, {
                    orderBy: 'createdTime',
                    orderDirection: 'desc',
                }),
                fetchTokenSnapshots(ponderClient, { chainId }, SNAPSHOT_LIST_FIELDS),
            ])
            const tokens = rows.map((t): LaunchToken => mapLaunchTokenItem(t, chainId))
            const now = Math.floor(Date.now() / 1000)
            const cutoff = now - 86400
            const snapshotMap = new Map<string, SnapshotData>()
            for (const s of snapshots) {
                const changePct = s.priceChange1dPct ? parseFloat(s.priceChange1dPct) : null
                const isStale =
                    s.price1dAgoTimestamp == null ||
                    s.price1dAgoTimestamp < cutoff - STALENESS_TOLERANCE
                snapshotMap.set(s.tokenAddr.toLowerCase(), {
                    lastSwapAt: s.lastSwapAt ?? 0,
                    marketCapNative: s.marketCapNative ?? '0',
                    athMarketCapNative: s.athMarketCapNative ?? '0',
                    lastPrice: s.lastPrice ?? '0',
                    priceChange1dPct: isStale ? null : changePct,
                })
            }
            return { tokens, snapshotMap }
        },
        staleTime: 30_000,
        enabled: supported,
    })

    // Durianfun isn't indexed yet (coshi's ponder work is still pending) — read it straight
    // from chain instead. Full log rescan is expensive, so cache it longer than the indexer query.
    const { data: durianfunBase, isLoading: durianfunLoading } = useQuery({
        queryKey: ['durianfun-token-list', chainId],
        queryFn: async () => {
            const tokens = await fetchDurianfunTokens(chainId)
            // Graduation/price/logo reads are a nice-to-have on top of discovery — if one of
            // those RPC calls fails, still show the tokens rather than losing the whole list.
            const [statuses, logos] = await Promise.all([
                fetchDurianfunGraduationStatus(tokens).catch(() => undefined),
                fetchDurianfunLogos(tokens).catch(() => undefined),
            ])
            return { tokens, statuses, logos }
        },
        staleTime: 5 * 60_000,
        enabled: durianfunEnabled,
    })

    const graduatedTokens: Pick<DurianfunToken, 'address'>[] = (durianfunBase?.tokens ?? []).filter(
        (t, i) => durianfunBase?.statuses?.[i]?.graduated
    )

    // A graduated token's bonding-curve currentPricePerToken() freezes at graduation and
    // drifts from the real Kublerx V3 price as it trades — refetched on the indexer's own
    // 30s cadence (matches useGraduatedMarketCaps) instead of the 5min discovery cache above.
    const { data: graduatedPrices } = useQuery({
        queryKey: ['durianfun-graduated-prices', chainId, graduatedTokens.map((t) => t.address)],
        queryFn: () => fetchGraduatedTokenPrices(graduatedTokens),
        staleTime: 30_000,
        enabled: durianfunEnabled && graduatedTokens.length > 0,
    })

    const durianfunEntries = durianfunBase?.tokens.map((t, i) =>
        toLaunchpadEntry(
            t,
            durianfunBase.statuses?.[i],
            durianfunBase.logos?.get(t.address.toLowerCase()),
            graduatedPrices?.get(t.address.toLowerCase())
        )
    )

    if (!supported) {
        return {
            tokens: [],
            snapshotMap: new Map<string, SnapshotData>(),
            isLoading: false,
            refetch: () => {},
        }
    }

    const snapshotMap = new Map(result?.snapshotMap ?? [])
    for (const entry of durianfunEntries ?? []) {
        snapshotMap.set(entry.token.address.toLowerCase(), {
            lastSwapAt: entry.token.createdTime,
            marketCapNative: entry.marketCapNative,
            athMarketCapNative: '0',
            lastPrice: '0',
            priceChange1dPct: null,
        })
    }

    return {
        tokens: [...(result?.tokens ?? []), ...(durianfunEntries ?? []).map((e) => e.token)],
        snapshotMap,
        isLoading: isLoading || (durianfunEnabled && durianfunLoading),
        refetch,
    }
}
