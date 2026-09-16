import { describe, expect, it } from 'vitest'
import { isTxSoundEnabled, playTxSound, setTxSoundEnabled } from '@/lib/tx-sfx'

describe('tx-sfx', () => {
    it('playTxSound is a no-op and does not throw without window (SSR)', () => {
        expect(typeof window).toBe('undefined')
        expect(() => playTxSound('success')).not.toThrow()
    })

    it('isTxSoundEnabled defaults to true', () => {
        expect(isTxSoundEnabled()).toBe(true)
    })

    it('round-trips through a localStorage stub', () => {
        const store = new Map<string, string>()
        const stub = {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value)
            },
        }
        ;(globalThis as unknown as { window: { localStorage: typeof stub } }).window = {
            localStorage: stub,
        }

        try {
            expect(isTxSoundEnabled()).toBe(true)
            setTxSoundEnabled(false)
            expect(isTxSoundEnabled()).toBe(false)
            setTxSoundEnabled(true)
            expect(isTxSoundEnabled()).toBe(true)
        } finally {
            delete (globalThis as { window?: unknown }).window
        }
    })

    it('does not throw when localStorage getter throws', () => {
        ;(globalThis as unknown as { window: { localStorage: unknown } }).window = {
            get localStorage(): unknown {
                throw new Error('blocked')
            },
        }

        try {
            expect(() => isTxSoundEnabled()).not.toThrow()
            expect(isTxSoundEnabled()).toBe(true)
            expect(() => setTxSoundEnabled(false)).not.toThrow()
        } finally {
            delete (globalThis as { window?: unknown }).window
        }
    })
})
