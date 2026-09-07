export const SECONDS_PER_MINUTE = 60
export const SECONDS_PER_HOUR = 3600
export const SECONDS_PER_DAY = 86400

export type DurationUnit = 'minutes' | 'hours' | 'days'

const UNIT_SECONDS: Record<DurationUnit, number> = {
    minutes: SECONDS_PER_MINUTE,
    hours: SECONDS_PER_HOUR,
    days: SECONDS_PER_DAY,
}

export function durationToSeconds(value: number, unit: DurationUnit): number {
    if (!Number.isFinite(value) || value <= 0) return 0
    return Math.round(value * UNIT_SECONDS[unit])
}

export function durationFromSeconds(seconds: number, unit: DurationUnit): number {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0
    return seconds / UNIT_SECONDS[unit]
}

function plural(value: number, noun: string): string {
    return `${value} ${noun}${value === 1 ? '' : 's'}`
}

/**
 * Human phrasing for a span of time, capped at two units so it stays scannable.
 * The UI never shows blocks or raw seconds, so every duration the user sees goes through here.
 */
export function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0 minutes'
    if (seconds < SECONDS_PER_MINUTE) return plural(Math.round(seconds), 'second')

    const days = Math.floor(seconds / SECONDS_PER_DAY)
    const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
    const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)

    if (days > 0) {
        return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day')
    }
    if (hours > 0) {
        return minutes > 0
            ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`
            : plural(hours, 'hour')
    }
    return plural(minutes, 'minute')
}

/** Compact variant for dense rows: "30d", "6h 30m", "45m". */
export function formatDurationShort(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0m'
    if (seconds < SECONDS_PER_MINUTE) return `${Math.round(seconds)}s`

    const days = Math.floor(seconds / SECONDS_PER_DAY)
    const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
    const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)

    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    return `${minutes}m`
}

export function formatRelativeTime(target: number, now: number): string {
    const diff = target - now
    if (Math.abs(diff) < SECONDS_PER_MINUTE) return 'just now'
    return diff > 0 ? `in ${formatDuration(diff)}` : `${formatDuration(-diff)} ago`
}

/** Same reading, sized for a button label or a table cell: "in 29d 23h". */
export function formatRelativeTimeShort(target: number, now: number): string {
    const diff = target - now
    if (Math.abs(diff) < SECONDS_PER_MINUTE) return 'now'
    return diff > 0 ? `in ${formatDurationShort(diff)}` : `${formatDurationShort(-diff)} ago`
}

export function formatDateTime(unixSeconds: number): string {
    if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return '—'
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function pad(value: number): string {
    return String(value).padStart(2, '0')
}

/** Local-time `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeLocalValue(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string): number | null {
    if (!value) return null
    const ms = new Date(value).getTime()
    if (!Number.isFinite(ms)) return null
    return Math.floor(ms / 1000)
}
