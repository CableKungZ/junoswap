import { resolveLaunchpadLogo } from '@/lib/logo'
import { applyLaunchpadTokenOverride } from '@/lib/launchpad-token-config'

interface LaunchTokenMeta {
    address: string
    name: string
    symbol: string
    logo: string
    description: string
    isGraduated: boolean
    marketCapNative: number | null
    priceChange1dPct: number | null
    nativeUsdPrice: number | null
}

const TOKEN_META_QUERY = `
  query TokenMeta {
    launchTokens {
      items {
        tokenAddr
        chainId
        name
        symbol
        logo
        description
        isGraduated
      }
    }
    tokenSnapshots {
      items {
        tokenAddr
        marketCapNative
        priceChange1dPct
      }
    }
    nativeUsdPrices(limit: 100) {
      items {
        chainId
        price
      }
    }
  }
`

interface TokenMetaResponse {
    data?: {
        launchTokens: {
            items: Array<{
                tokenAddr: string
                chainId: number
                name: string
                symbol: string
                logo: string
                description: string
                isGraduated: number
            }>
        }
        tokenSnapshots: {
            items: Array<{
                tokenAddr: string
                marketCapNative: string
                priceChange1dPct: string | null
            }>
        }
        nativeUsdPrices: {
            items: Array<{ chainId: number; price: string }>
        }
    }
}

export async function fetchLaunchTokenMeta(address: string): Promise<LaunchTokenMeta | null> {
    const ponderUrl = process.env.PONDER_URL
    if (!ponderUrl) return null

    try {
        const response = await fetch(`${ponderUrl}/graphql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: TOKEN_META_QUERY }),
            signal: AbortSignal.timeout(5_000),
            next: { revalidate: 60 },
        })
        if (!response.ok) return null

        const { data } = (await response.json()) as TokenMetaResponse
        if (!data) return null

        const addr = address.toLowerCase()
        const raw = data.launchTokens.items.find((t) => t.tokenAddr.toLowerCase() === addr)
        if (!raw) return null
        const token = applyLaunchpadTokenOverride(raw, raw.chainId)

        const snapshot = data.tokenSnapshots.items.find((s) => s.tokenAddr.toLowerCase() === addr)
        const marketCap = snapshot ? parseFloat(snapshot.marketCapNative) : NaN

        const rawUsd = data.nativeUsdPrices.items.find((p) => p.chainId === token.chainId)?.price
        const nativeUsdPrice = rawUsd ? parseFloat(rawUsd) : NaN

        return {
            address,
            name: token.name ?? '',
            symbol: token.symbol ?? '',
            logo: resolveLaunchpadLogo(token.logo),
            description: token.description ?? '',
            isGraduated: token.isGraduated === 1,
            marketCapNative: Number.isFinite(marketCap) && marketCap > 0 ? marketCap : null,
            priceChange1dPct: snapshot?.priceChange1dPct
                ? parseFloat(snapshot.priceChange1dPct)
                : null,
            nativeUsdPrice:
                Number.isFinite(nativeUsdPrice) && nativeUsdPrice > 0 ? nativeUsdPrice : null,
        }
    } catch {
        return null
    }
}
