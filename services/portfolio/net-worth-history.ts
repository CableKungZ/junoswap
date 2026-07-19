export { sanitizePricePoints } from '@coshi190/junoswap-sdk'

export interface NetWorthPoint {
    timestamp: number
    value: number
}

export interface PricePoint {
    timestamp: number
    price: number
}

export const DAY_SECONDS = 86_400
export const MAX_POINTS = 96

export function downsample(
    series: NetWorthPoint[],
    startSec: number,
    nowSec: number
): NetWorthPoint[] {
    if (series.length <= MAX_POINTS) return series

    const bucketSize = (nowSec - startSec) / MAX_POINTS
    const byBucket = new Map<number, NetWorthPoint>()
    for (const point of series) {
        const bucket = Math.floor((point.timestamp - startSec) / bucketSize)
        byBucket.set(bucket, point)
    }
    return [...byBucket.values()]
}
