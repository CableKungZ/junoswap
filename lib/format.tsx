import { formatUnits } from 'viem'
import type { ReactNode } from 'react'

export function formatTvl(tvlUsd: number): string {
    if (tvlUsd <= 0) return '$0.00'
    if (tvlUsd >= 1_000_000) return `$${(tvlUsd / 1_000_000).toFixed(2)}M`
    if (tvlUsd >= 1_000) return `$${(tvlUsd / 1_000).toFixed(2)}K`
    return `$${tvlUsd.toFixed(2)}`
}

export function formatApr(apr: number | null, isLoading: boolean): ReactNode {
    if (isLoading) {
        return <div className="h-4 w-16 bg-muted rounded animate-pulse" />
    }
    if (apr === null || apr === 0) {
        return <span className="text-sm text-muted-foreground">--</span>
    }
    if (apr >= 100) {
        return (
            <span className="text-sm font-medium">
                {apr.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
            </span>
        )
    }
    if (apr >= 0.01) {
        return <span className="text-sm font-medium">{apr.toFixed(2)}%</span>
    }
    return <span className="text-sm font-medium">&lt;0.01%</span>
}

export function formatLiquidityAmount(value: bigint, decimals: number): string {
    const num = Number(value) / Math.pow(10, decimals)
    if (num === 0) return '0'
    if (num >= 1_000) return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
    if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    const leadingZeros = Math.max(0, -Math.floor(Math.log10(num)) - 1)
    return num.toFixed(leadingZeros + 3)
}

export function formatRewardAmount(value: bigint, decimals: number): string {
    if (value === 0n) return '0'
    const num = Number(value) / Math.pow(10, decimals)
    if (num === 0) return '0'
    if (num >= 100) return num.toFixed(0)
    if (num >= 10) return num.toFixed(1)
    if (num >= 1) return num.toFixed(2)
    const leadingZeros = Math.max(0, -Math.floor(Math.log10(num)) - 1)
    return num.toFixed(leadingZeros + 3)
}

/**
 * The whole number with thousands separators. For limits and caps, where an abbreviation like
 * "2.00K" hides the exact figure the contract enforces.
 */
export function formatExactAmount(amount: bigint, decimals: number): string {
    return Number(formatUnits(amount, decimals)).toLocaleString('en-US', {
        maximumFractionDigits: 6,
    })
}

/** Shared APR reading: thousands separated, one decimal, and a floor so 0.4% never reads as 0%. */
export function formatAprPercent(apr: number | null | undefined): string {
    if (apr === null || apr === undefined || !Number.isFinite(apr)) return '—'
    if (apr >= 1000) return `${Math.round(apr).toLocaleString('en-US')}%`
    if (apr >= 1)
        return `${apr.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    return apr > 0 ? '<1%' : '0%'
}

export function formatRateAmount(amount: number, symbol = ''): string {
    const digits = amount >= 100 ? 0 : amount >= 1 ? 2 : 6
    return `${amount.toLocaleString('en-US', { maximumFractionDigits: digits })} ${symbol}`.trim()
}

export function formatChartPrice(value: number): string {
    if (!Number.isFinite(value) || value === 0) return '0'
    if (value >= 1000) return value.toFixed(2)
    if (value >= 1) return value.toFixed(3)
    if (value >= 0.01) return value.toFixed(4)
    if (value >= 0.0001) return value.toFixed(6).replace(/\.?0+$/, '')

    const exp = Math.floor(Math.log10(value)) // e.g. -5 for 9.95e-5
    let leadingZeros = -exp - 1 // zeros after "0." before the first significant digit
    let digits = Math.round((value / 10 ** exp) * 1000) // mantissa ∈ [1,10) → 4 sig figs
    if (digits >= 10000) {
        digits = Math.round(digits / 10)
        leadingZeros -= 1
    }
    const sig = String(digits).replace(/0+$/, '') || '0'
    return `0.${'0'.repeat(leadingZeros)}${sig}`
}
