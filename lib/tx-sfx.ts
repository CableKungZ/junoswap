// Zero-asset transaction sound effects, synthesized with the Web Audio API.

export type TxSound = 'step' | 'success' | 'error' | 'submit'

const STORAGE_KEY = 'junoswap.sfx'

let sharedCtx: AudioContext | null = null

// Lazy: this module is imported during SSR, where `window`/AudioContext don't exist.
function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!sharedCtx) sharedCtx = new Ctor()
    return sharedCtx
}

export function isTxSoundEnabled(): boolean {
    try {
        // On unless the user has muted it; only an explicit '0' turns it off.
        return window.localStorage.getItem(STORAGE_KEY) !== '0'
    } catch {
        // Storage blocked (private browsing) still gets sound. On the server there is no
        // AudioContext, so playTxSound bails before this answer matters.
        return true
    }
}

export function setTxSoundEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {
        // ignore — nothing we can persist
    }
}

function prefersReducedMotion(): boolean {
    try {
        return (
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
    } catch {
        return false
    }
}

function tone(
    ctx: AudioContext,
    {
        freq,
        start,
        duration,
        peak = 0.08,
        type = 'sine',
    }: { freq: number; start: number; duration: number; peak?: number; type?: OscillatorType }
) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    // Gain envelope can't ramp to exactly 0 with exponentialRampToValueAtTime (it throws),
    // so ramp to a near-zero floor to avoid a click at the tail.
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
    osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
    }
}

export function playTxSound(sound: TxSound): void {
    try {
        if (!isTxSoundEnabled()) return
        if (prefersReducedMotion()) return

        const ctx = getAudioContext()
        if (!ctx) return

        // Browsers suspend AudioContext until a user gesture; resume best-effort.
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {})
        }

        const now = ctx.currentTime
        switch (sound) {
            case 'submit':
                tone(ctx, { freq: 220, start: now, duration: 0.12, peak: 0.07, type: 'sine' })
                break
            case 'step':
                tone(ctx, { freq: 660, start: now, duration: 0.06, peak: 0.06, type: 'triangle' })
                break
            case 'success':
                tone(ctx, { freq: 523.25, start: now, duration: 0.14, peak: 0.09, type: 'sine' })
                tone(ctx, {
                    freq: 783.99,
                    start: now + 0.1,
                    duration: 0.18,
                    peak: 0.1,
                    type: 'sine',
                })
                break
            case 'error':
                tone(ctx, { freq: 220, start: now, duration: 0.16, peak: 0.08, type: 'sine' })
                tone(ctx, {
                    freq: 164.81,
                    start: now + 0.1,
                    duration: 0.18,
                    peak: 0.07,
                    type: 'sine',
                })
                break
        }
    } catch {
        // Audio must never break the app.
    }
}
