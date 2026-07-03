import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Token } from '@/types/tokens'

/**
 * State for the SwapAggregator tab — kept separate from swap-store so
 * aggregator tokens / DEX toggles / slippage never leak into the normal swap tab.
 */
interface AggregatorSettings {
    slippage: number // percent, e.g. 0.5
    deadlineMinutes: number
    /** dexKeys the user excluded from routing (empty = use all). */
    disabledDexKeys: string[]
}

interface AggregatorStore {
    tokenIn: Token | null
    tokenOut: Token | null
    amountIn: string
    settings: AggregatorSettings
    setTokenIn: (token: Token | null) => void
    setTokenOut: (token: Token | null) => void
    setAmountIn: (amount: string) => void
    swapTokens: () => void
    setSlippage: (slippage: number) => void
    setDeadlineMinutes: (minutes: number) => void
    toggleDex: (dexKey: string) => void
    reset: () => void
}

const defaultSettings: AggregatorSettings = {
    slippage: 0.5,
    deadlineMinutes: 20,
    disabledDexKeys: [],
}

export const useAggregatorStore = create<AggregatorStore>()(
    devtools(
        persist(
            (set) => ({
                tokenIn: null,
                tokenOut: null,
                amountIn: '',
                settings: defaultSettings,

                setTokenIn: (token) => set({ tokenIn: token }),

                setTokenOut: (token) => set({ tokenOut: token }),

                setAmountIn: (amountIn) => set({ amountIn }),

                swapTokens: () =>
                    set((state) => ({
                        tokenIn: state.tokenOut,
                        tokenOut: state.tokenIn,
                        amountIn: '',
                    })),

                setSlippage: (slippage) =>
                    set((state) => ({ settings: { ...state.settings, slippage } })),

                setDeadlineMinutes: (deadlineMinutes) =>
                    set((state) => ({ settings: { ...state.settings, deadlineMinutes } })),

                toggleDex: (dexKey) =>
                    set((state) => {
                        const disabled = state.settings.disabledDexKeys
                        return {
                            settings: {
                                ...state.settings,
                                disabledDexKeys: disabled.includes(dexKey)
                                    ? disabled.filter((k) => k !== dexKey)
                                    : [...disabled, dexKey],
                            },
                        }
                    }),

                reset: () =>
                    set({ tokenIn: null, tokenOut: null, amountIn: '', settings: defaultSettings }),
            }),
            { name: 'aggregator-settings' }
        )
    )
)
