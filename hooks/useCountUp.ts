'use client'

import { useEffect, useRef, useState } from 'react'
import { countValue } from '@/lib/tx-flow'

/**
 * Counts from zero up to `to` while `active`, then holds the target.
 *
 * The run restarts whenever `to` changes, so a quote that moves mid-confirmation
 * animates to the new figure rather than jumping. Inactive means the target is
 * shown outright — a settled value should never animate on a re-render.
 */
export function useCountUp(to: number, active: boolean, duration = 1200): number {
    const [value, setValue] = useState(active ? 0 : to)
    const frame = useRef(0)

    useEffect(() => {
        if (!active || !Number.isFinite(to)) {
            setValue(to)
            return
        }
        const start = performance.now()
        const step = (now: number) => {
            const elapsed = now - start
            setValue(countValue(to, elapsed, duration))
            if (elapsed < duration) frame.current = requestAnimationFrame(step)
        }
        frame.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame.current)
    }, [to, active, duration])

    return value
}
