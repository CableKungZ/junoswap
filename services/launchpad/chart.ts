import { formatEther } from 'viem'
import type { Timeframe, ChartMode, CandlestickData } from '@/types/chart'
import { TIMEFRAME_DURATIONS } from '@/types/chart'
import { computePoolPrice } from '@/lib/tick-math'
import { TOTAL_SUPPLY } from '@/lib/launchpad-curve'
import type { LaunchpadPlatform } from '@/types/launchpad'

/**
 * Trading fee per launchpad curve. Junoswap takes 1% of the input side, so sell fees are paid in
 * the launch token. Durianfun takes 1.17% in KUB on both sides: off `kubIn` on a buy, and off the
 * gross proceeds on a sell (the seller receives gross minus fee). Mirrors the junoswap-core
 * indexer's curve registry (JUNOSWAP_V1_CURVE / DURIANFUN_CURVE feeBps).
 */
export const CURVE_FEE_BPS: Record<LaunchpadPlatform, number> = {
    junoswap: 100,
    durianfun: 117,
}

function calculateVolume(event: CurveSwapEvent): number {
    return event.isBuy
        ? parseFloat(formatEther(event.amountIn))
        : parseFloat(formatEther(event.amountOut))
}

export function aggregateCandlesticks(
    events: CurveSwapEvent[],
    timeframe: Timeframe,
    mode: ChartMode = 'mcap'
): CandlestickData[] {
    if (events.length === 0) return []

    const duration = TIMEFRAME_DURATIONS[timeframe]
    const candles = new Map<number, CandlestickData>()

    for (const event of events) {
        const scale = mode === 'mcap' ? TOTAL_SUPPLY : 1
        const value = event.priceNative * scale
        const volume = calculateVolume(event)
        if (value <= 0) continue

        const candleTime = Math.floor(event.timestamp / duration) * duration

        const existing = candles.get(candleTime)
        if (!existing) {
            const openValue = event.preSwapPriceNative * scale
            const open = openValue > 0 ? openValue : value
            candles.set(candleTime, {
                time: candleTime,
                open,
                high: Math.max(open, value),
                low: Math.min(open, value),
                close: value,
                volume,
            })
        } else {
            existing.high = Math.max(existing.high, value)
            existing.low = Math.min(existing.low, value)
            existing.close = value
            existing.volume += volume
        }
    }

    const times = Array.from(candles.keys()).sort((a, b) => a - b)
    if (times.length === 0) return Array.from(candles.values())
    const firstTime = times[0]!
    const lastTime = times[times.length - 1]!
    let prevClose = candles.get(firstTime)!.close
    for (let t = firstTime + duration; t <= lastTime; t += duration) {
        if (!candles.has(t)) {
            candles.set(t, {
                time: t,
                open: prevClose,
                high: prevClose,
                low: prevClose,
                close: prevClose,
                volume: 0,
            })
        } else {
            prevClose = candles.get(t)!.close
        }
    }

    return Array.from(candles.values()).sort((a, b) => a.time - b.time)
}

export interface PricePoint {
    timestamp: number
    price: number
    volume?: number
}

export function aggregatePricePoints(
    points: PricePoint[],
    timeframe: Timeframe
): CandlestickData[] {
    if (points.length === 0) return []

    const duration = TIMEFRAME_DURATIONS[timeframe]
    const candles = new Map<number, CandlestickData>()

    for (const point of points) {
        if (point.price <= 0) continue
        const candleTime = Math.floor(point.timestamp / duration) * duration
        const existing = candles.get(candleTime)
        if (!existing) {
            candles.set(candleTime, {
                time: candleTime,
                open: point.price,
                high: point.price,
                low: point.price,
                close: point.price,
                volume: point.volume ?? 0,
            })
        } else {
            existing.high = Math.max(existing.high, point.price)
            existing.low = Math.min(existing.low, point.price)
            existing.close = point.price
            existing.volume += point.volume ?? 0
        }
    }

    return Array.from(candles.values()).sort((a, b) => a.time - b.time)
}

export function buildContinuousSeries(
    candles: CandlestickData[],
    timeframe: Timeframe,
    maxCandles = 500,
    nowSec: number = Math.floor(Date.now() / 1000)
): CandlestickData[] {
    if (candles.length === 0) return []

    const duration = TIMEFRAME_DURATIONS[timeframe]
    const byTime = new Map<number, CandlestickData>()
    for (const c of candles) byTime.set(c.time, c)

    const firstBucket = candles[0]!.time
    const lastBucket = candles[candles.length - 1]!.time
    const nowBucket = Math.floor(nowSec / duration) * duration
    const endTime = Math.max(lastBucket, nowBucket)
    const startTime = Math.max(firstBucket, endTime - (maxCandles - 1) * duration)

    let prevClose: number | undefined
    for (const c of candles) {
        if (c.time < startTime) prevClose = c.close
        else break
    }
    if (prevClose === undefined) {
        const firstInWindow = candles.find((c) => c.time >= startTime)
        prevClose = firstInWindow ? firstInWindow.open : candles[0]!.close
    }

    const result: CandlestickData[] = []
    for (let t = startTime; t <= endTime; t += duration) {
        const real = byTime.get(t)
        if (real) {
            result.push({
                ...real,
                open: prevClose,
                high: Math.max(real.high, prevClose),
                low: Math.min(real.low, prevClose),
            })
            prevClose = real.close
        } else {
            result.push({
                time: t,
                open: prevClose,
                high: prevClose,
                low: prevClose,
                close: prevClose,
                volume: 0,
            })
        }
    }

    return result
}

export const SAFE_CANDLE_VALUE_MAX = 9_000_000_000_000

export function sanitizeCandles(candles: CandlestickData[]): CandlestickData[] {
    const ok = (v: number) => Number.isFinite(v) && Math.abs(v) <= SAFE_CANDLE_VALUE_MAX
    return candles
        .filter((c) => ok(c.open) && ok(c.high) && ok(c.low) && ok(c.close))
        .map((c) => (ok(c.volume) ? c : { ...c, volume: 0 }))
}

export interface CurveSwapEvent {
    timestamp: number
    isBuy: boolean
    amountIn: bigint
    amountOut: bigint
    priceNative: number
    preSwapPriceNative: number
    sender?: string
}

export interface V3SwapEvent {
    timestamp: number
    amount0: string
    amount1: string
    sqrtPriceX96: string
    tick: number
    txFrom?: string
    tokenIsToken0?: number
}

export function aggregateV3Candlesticks(
    events: V3SwapEvent[],
    timeframe: Timeframe,
    mode: ChartMode = 'mcap',
    tokenIsToken0: boolean
): CandlestickData[] {
    if (events.length === 0) return []

    const duration = TIMEFRAME_DURATIONS[timeframe]
    const candles = new Map<number, CandlestickData>()
    // V3 swap events only carry the post-trade price, unlike bonding-curve events (which can
    // unwind to a true pre-trade price via calculatePreSwapPrice). So a bucket's open is taken
    // from the previous trade's close instead — otherwise a bucket with a single trade would
    // open/high/low/close on that one price and render as a flat, wick-less point.
    let prevTradeClose: number | null = null

    for (const event of events) {
        const sqrtPrice = BigInt(event.sqrtPriceX96)
        const price = computePoolPrice({
            sqrtPriceX96: sqrtPrice,
            decimals0: 18,
            decimals1: 18,
            invert: !tokenIsToken0,
        })
        const value = mode === 'mcap' ? price * TOTAL_SUPPLY : price
        if (value <= 0) continue

        const amount0 = BigInt(event.amount0)
        const amount1 = BigInt(event.amount1)
        const absNative = tokenIsToken0
            ? amount1 < 0n
                ? -amount1
                : amount1
            : amount0 < 0n
              ? -amount0
              : amount0
        const volume = parseFloat(formatEther(absNative))

        const candleTime = Math.floor(event.timestamp / duration) * duration

        const existing = candles.get(candleTime)
        if (!existing) {
            const open = prevTradeClose ?? value
            candles.set(candleTime, {
                time: candleTime,
                open,
                high: Math.max(open, value),
                low: Math.min(open, value),
                close: value,
                volume,
            })
        } else {
            existing.high = Math.max(existing.high, value)
            existing.low = Math.min(existing.low, value)
            existing.close = value
            existing.volume += volume
        }
        prevTradeClose = value
    }

    const times = Array.from(candles.keys()).sort((a, b) => a - b)
    if (times.length === 0) return Array.from(candles.values())
    const firstTime = times[0]!
    const lastTime = times[times.length - 1]!
    let prevClose = candles.get(firstTime)!.close
    for (let t = firstTime + duration; t <= lastTime; t += duration) {
        if (!candles.has(t)) {
            candles.set(t, {
                time: t,
                open: prevClose,
                high: prevClose,
                low: prevClose,
                close: prevClose,
                volume: 0,
            })
        } else {
            prevClose = candles.get(t)!.close
        }
    }

    return Array.from(candles.values()).sort((a, b) => a.time - b.time)
}

export function tokenNativeCandles(
    events: V3SwapEvent[],
    tokenAddr: string,
    tokenDecimals: number,
    wrappedNativeAddr: string,
    nativeDecimals: number,
    timeframe: Timeframe
): CandlestickData[] {
    const tokenIsToken0 = tokenAddr.toLowerCase() < wrappedNativeAddr.toLowerCase()
    const raw = aggregateV3Candlesticks(events, timeframe, 'price', tokenIsToken0)
    const factor = 10 ** (tokenDecimals - nativeDecimals)
    const scaled =
        factor === 1
            ? raw
            : raw.map((c) => ({
                  ...c,
                  open: c.open * factor,
                  high: c.high * factor,
                  low: c.low * factor,
                  close: c.close * factor,
              }))
    return buildContinuousSeries(sanitizeCandles(scaled), timeframe)
}

export function ratioCandles(base: CandlestickData[], quote: CandlestickData[]): CandlestickData[] {
    const q = new Map(quote.map((c) => [c.time, c]))
    const out: CandlestickData[] = []
    for (const b of base) {
        const qc = q.get(b.time)
        if (!qc) continue
        if (qc.open <= 0 || qc.high <= 0 || qc.low <= 0 || qc.close <= 0) continue
        out.push({
            time: b.time,
            open: b.open / qc.open,
            high: b.high / qc.low,
            low: b.low / qc.high,
            close: b.close / qc.close,
            volume: 0,
        })
    }
    return out
}

export function stitchCandlesticks(
    bondingCurveCandles: CandlestickData[],
    v3Candles: CandlestickData[],
    graduatedAtTimestamp: number | null
): CandlestickData[] {
    if (v3Candles.length === 0) return bondingCurveCandles
    // A token that graduated on a third-party market (e.g. Durianfun) never touched Junoswap's
    // own bonding-curve contract, so there's no pre-graduation history and the indexer's
    // graduatedAt (tied to Junoswap's own graduation event) is never set for it either -- show
    // the real V3 trades instead of going blank.
    if (bondingCurveCandles.length === 0) return v3Candles
    if (!graduatedAtTimestamp) return bondingCurveCandles

    const preGrad = bondingCurveCandles.filter((c) => c.time < graduatedAtTimestamp)
    const postGrad = v3Candles.filter((c) => c.time >= graduatedAtTimestamp)

    if (preGrad.length > 0 && postGrad.length > 0) {
        const lastPre = preGrad[preGrad.length - 1]!
        const firstPost = postGrad[0]!
        firstPost.open = lastPre.close
        // Graduation can gap hard between the bonding-curve close and the V3 pool's first
        // trade, so the bridged open can land outside this candle's own high/low — re-clamp
        // or the chart's price scale chokes on an open outside [low, high].
        firstPost.high = Math.max(firstPost.high, firstPost.open)
        firstPost.low = Math.min(firstPost.low, firstPost.open)
    }

    return [...preGrad, ...postGrad]
}

export interface CreatorTrade {
    timestamp: number
    isBuy: boolean
    nativeAmount: number // KUB spent (buy) or received (sell), ether units
    tokenAmount: number // launch tokens received (buy) or sold (sell), ether units
}

export interface CreatorMarkerPoint {
    time: number // candle bucket time (pre-toLocalChartTime)
    isBuy: boolean
    nativeAmount: number // summed over the bucket's same-side trades
    tokenAmount: number
    timestamp: number // latest real trade time in the bucket
}

function absBigInt(v: bigint): bigint {
    return v < 0n ? -v : v
}

export function extractCreatorTrades(
    bcEvents: Array<
        Pick<CurveSwapEvent, 'timestamp' | 'isBuy' | 'sender' | 'amountIn' | 'amountOut'>
    >,
    v3Events: Array<
        Pick<V3SwapEvent, 'timestamp' | 'amount0' | 'amount1' | 'txFrom' | 'tokenIsToken0'>
    >,
    creator: string,
    graduatedAt: number | null
): CreatorTrade[] {
    const target = creator.toLowerCase()
    const splitAt = graduatedAt !== null && v3Events.length > 0 ? graduatedAt : null

    const trades: CreatorTrade[] = []
    for (const e of bcEvents) {
        if (e.sender?.toLowerCase() !== target) continue
        if (splitAt !== null && e.timestamp >= splitAt) continue
        const nativeAmount = parseFloat(formatEther(e.isBuy ? e.amountIn : e.amountOut))
        const tokenAmount = parseFloat(formatEther(e.isBuy ? e.amountOut : e.amountIn))
        trades.push({ timestamp: e.timestamp, isBuy: e.isBuy, nativeAmount, tokenAmount })
    }
    if (splitAt !== null) {
        for (const e of v3Events) {
            if (e.txFrom?.toLowerCase() !== target) continue
            if (e.timestamp < splitAt) continue
            const tokenRaw = BigInt(e.tokenIsToken0 === 1 ? e.amount0 : e.amount1)
            const nativeRaw = BigInt(e.tokenIsToken0 === 1 ? e.amount1 : e.amount0)
            trades.push({
                timestamp: e.timestamp,
                isBuy: tokenRaw < 0n, // token leaving the pool → creator received tokens
                nativeAmount: parseFloat(formatEther(absBigInt(nativeRaw))),
                tokenAmount: parseFloat(formatEther(absBigInt(tokenRaw))),
            })
        }
    }
    return trades.sort((a, b) => a.timestamp - b.timestamp)
}

export function buildCreatorMarkers(
    trades: CreatorTrade[],
    timeframe: Timeframe,
    candleTimes: number[]
): CreatorMarkerPoint[] {
    if (trades.length === 0) return []

    const duration = TIMEFRAME_DURATIONS[timeframe]
    const rendered = new Set(candleTimes)
    const buckets = new Map<string, CreatorMarkerPoint>()

    for (const trade of trades) {
        const bucket = Math.floor(trade.timestamp / duration) * duration
        if (!rendered.has(bucket)) continue
        const key = `${bucket}:${trade.isBuy ? 'b' : 's'}`
        const existing = buckets.get(key)
        if (existing) {
            existing.nativeAmount += trade.nativeAmount
            existing.tokenAmount += trade.tokenAmount
            existing.timestamp = trade.timestamp // trades are time-sorted → latest wins
        } else {
            buckets.set(key, {
                time: bucket,
                isBuy: trade.isBuy,
                nativeAmount: trade.nativeAmount,
                tokenAmount: trade.tokenAmount,
                timestamp: trade.timestamp,
            })
        }
    }

    return Array.from(buckets.values()).sort((a, b) =>
        a.time === b.time ? Number(b.isBuy) - Number(a.isBuy) : a.time - b.time
    )
}

export interface FeeBreakdown {
    nativeFees: number // KUB collected in fees
    tokenFees: number // launch tokens collected from sell-side fees (Junoswap only)
    totalNative: number // KUB-denominated combined total (sell fees valued at the KUB received)
    feeBps: number
}

export function computeFeeBreakdown(
    events: CurveSwapEvent[],
    platform: LaunchpadPlatform = 'junoswap'
): FeeBreakdown {
    const feeBps = CURVE_FEE_BPS[platform]
    const feeRate = feeBps / 10000
    let nativeFees = 0
    let tokenFees = 0
    let totalNative = 0

    for (const e of events) {
        const amountIn = parseFloat(formatEther(e.amountIn))
        const amountOut = parseFloat(formatEther(e.amountOut))
        if (e.isBuy) {
            nativeFees += amountIn * feeRate
            totalNative += amountIn * feeRate
        } else if (platform === 'durianfun') {
            // amountOut is net of the fee, so the fee on the gross is out * rate / (1 - rate).
            const fee = (amountOut * feeRate) / (1 - feeRate)
            nativeFees += fee
            totalNative += fee
        } else {
            tokenFees += amountIn * feeRate
            totalNative += amountOut * feeRate
        }
    }

    return { nativeFees, tokenFees, totalNative, feeBps }
}

export interface DailyMetrics {
    volume1d: number
    priceChange1dPct: number
    feeBreakdown?: FeeBreakdown
    athMarketCap?: number
}

// The indexer's TokenSnapshot.athMarketCapNative freezes at graduation (backend doesn't sync it
// afterward -- see project notes), so it undercounts any peak reached later on the graduated
// pool. Read the true peak from the same swap history the chart renders instead, always in mcap
// terms regardless of the user's price/mcap toggle. Bucket size doesn't matter for a max, so a
// coarse '1d' bucket is used to keep this cheap.
export function computeAthMarketCap(
    bcEvents: CurveSwapEvent[],
    v3Events: V3SwapEvent[],
    tokenIsToken0: boolean
): number {
    const bcCandles = aggregateCandlesticks(bcEvents, '1d', 'mcap')
    const v3Candles = aggregateV3Candlesticks(v3Events, '1d', 'mcap', tokenIsToken0)
    let ath = 0
    for (const c of bcCandles) if (c.high > ath) ath = c.high
    for (const c of v3Candles) if (c.high > ath) ath = c.high
    return ath
}

/** Downsamples a chronological price series into `bucketCount` buckets, keeping each bucket's
 *  min and max (in original order) plus the first and last price -- so spikes and dips survive
 *  and the line still ends on the current price. Returns at most bucketCount * 2 + 2 points. */
export function downsamplePrices(prices: number[], bucketCount = 24): number[] {
    if (prices.length <= bucketCount * 2) return prices
    const size = prices.length / bucketCount
    const keep = new Set([0, prices.length - 1])
    for (let b = 0; b < bucketCount; b++) {
        const start = Math.floor(b * size)
        const end = Math.floor((b + 1) * size)
        let lo = start
        let hi = start
        for (let i = start + 1; i < end; i++) {
            if (prices[i]! < prices[lo]!) lo = i
            if (prices[i]! > prices[hi]!) hi = i
        }
        keep.add(lo).add(hi)
    }
    return [...keep].sort((a, b) => a - b).map((i) => prices[i]!)
}

/** Real-data equivalent of the fixed decorative path in TokenCard's ChartOverlay -- an SVG path
 *  string over a 0-112 viewBox tracing actual price samples (normalized to the min/max of the
 *  series, since only the trend shape matters here, not absolute values). */
export function buildSparklinePath(prices: number[]): string | null {
    if (prices.length < 2) return null

    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min

    const points = prices.map((price, i) => {
        const x = (i / (prices.length - 1)) * 96 + 4
        // Flat series (range === 0) draws a straight line across the middle rather than div-by-0.
        const y = range > 0 ? 100 - ((price - min) / range) * 88 : 56
        return `${x},${y}`
    })

    return `M${points.join(' L')}`
}

export const SPARKLINE_HOURS = 24 * 7

/** Token-card sparkline from sparse hourly candles: last 7 days on a gap-filled time axis (quiet
 *  stretches read flat instead of being squeezed out), downsampled so spikes survive. */
export function buildHourlySparkline(hourly: CandlestickData[]): string | null {
    const closes = buildContinuousSeries(hourly, '1h', SPARKLINE_HOURS).map((c) => c.close)
    return buildSparklinePath(downsamplePrices(closes))
}

/** Splits an "Mx,y Lx,y ..." sparkline path into runs of rising/falling segments so each run can
 *  be colored like a candle. SVG y grows downward, so a smaller y means the price went up. Flat
 *  segments join the run before them. */
export function splitSparklineByDirection(path: string): { d: string; isUp: boolean }[] {
    const points = path.slice(1).split(' L')
    const runs: { d: string; isUp: boolean }[] = []
    for (let i = 1; i < points.length; i++) {
        const prevY = parseFloat(points[i - 1]!.split(',')[1]!)
        const y = parseFloat(points[i]!.split(',')[1]!)
        const last = runs.at(-1)
        const isUp = y === prevY ? (last?.isUp ?? true) : y < prevY
        if (last?.isUp === isUp) last.d += ` L${points[i]}`
        else runs.push({ d: `M${points[i - 1]} L${points[i]}`, isUp })
    }
    return runs
}

export function computeDailyMetrics(
    candles: CandlestickData[],
    usdPrice: number | null
): DailyMetrics | null {
    if (candles.length === 0) return null

    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - 86400

    let volume1d = 0
    for (const c of candles) {
        if (c.time >= cutoff) {
            volume1d += c.volume
        }
    }
    if (usdPrice !== null) {
        volume1d *= usdPrice
    }

    const sortedBefore = candles.filter((c) => c.time <= cutoff).sort((a, b) => b.time - a.time)
    const priceThen = sortedBefore.length > 0 ? sortedBefore[0]!.close : null

    const priceNow = candles[candles.length - 1]!.close

    let priceChange1dPct = 0
    if (priceThen !== null && priceThen > 0) {
        priceChange1dPct = ((priceNow - priceThen) / priceThen) * 100
    } else {
        const firstOpen = candles[0]!.open
        if (firstOpen > 0) {
            priceChange1dPct = ((priceNow - firstOpen) / firstOpen) * 100
        }
    }

    return { volume1d, priceChange1dPct }
}
