import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Token } from '@/types/tokens'
import type { SwapSettings, SwapState, QuoteResult, DexQuote } from '@/types/swap'
import type { DEXType } from '@/types/dex'

interface SwapStore extends SwapState {
    // Settings
    settings: SwapSettings
    // DEX selection
    selectedDex: DEXType
    // Multi-DEX quotes state
    dexQuotes: Record<DEXType, DexQuote>
    bestQuoteDex: DEXType | null
    // URL sync state
    isUpdatingFromUrl: boolean

    // Actions
    setTokenIn: (token: Token | null) => void
    setTokenOut: (token: Token | null) => void
    setSelectedDex: (dex: DEXType) => void
    setAmountIn: (amount: string) => void
    setAmountOut: (amount: string) => void
    setQuote: (quote: QuoteResult | null) => void
    setIsLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    setSlippage: (slippage: number) => void
    setSlippagePreset: (preset: '0.1' | '0.5' | '1' | 'custom') => void
    setDeadlineMinutes: (minutes: number) => void
    setExpertMode: (enabled: boolean) => void
    setAutoSelectBestDex: (enabled: boolean) => void
    setIsUpdatingFromUrl: (updating: boolean) => void
    setDexQuotes: (quotes: Record<DEXType, DexQuote>) => void
    setBestQuoteDex: (dexId: DEXType | null) => void
    clearDexQuotes: () => void
    swapTokens: () => void
    reset: () => void
}

// Default swap settings
const defaultSettings: SwapSettings = {
    slippage: 0.5,
    slippagePreset: '0.5',
    deadlineMinutes: 20,
    expertMode: false,
    autoSelectBestDex: true,
}

// Initial swap state
const initialState: SwapState = {
    tokenIn: null,
    tokenOut: null,
    amountIn: '',
    amountOut: '',
    quote: null,
    isLoading: false,
    error: null,
    isUpdatingFromUrl: false,
}

export const useSwapStore = create<SwapStore>()(
    devtools(
        persist(
            (set, _get) => ({
                ...initialState,
                settings: defaultSettings,
                selectedDex: 'cmswap',
                dexQuotes: {},
                bestQuoteDex: null,

                // Token actions
                setTokenIn: (token) => set({ tokenIn: token }),

                setTokenOut: (token) => set({ tokenOut: token }),

                setSelectedDex: (dex) => set({ selectedDex: dex }),

                // Amount actions
                setAmountIn: (amount) => set({ amountIn: amount }),

                setAmountOut: (amount) => set({ amountOut: amount }),

                // Quote actions
                setQuote: (quote) => set({ quote }),

                // Loading state
                setIsLoading: (loading) => set({ isLoading: loading }),

                // Error state
                setError: (error) => set({ error }),

                // Settings actions
                setSlippage: (slippage) =>
                    set((state) => ({
                        settings: {
                            ...state.settings,
                            slippage,
                            slippagePreset: ['0.1', '0.5', '1'].includes(slippage.toString())
                                ? (slippage.toString() as '0.1' | '0.5' | '1')
                                : 'custom',
                        },
                    })),

                setSlippagePreset: (preset) =>
                    set((state) => ({
                        settings: {
                            ...state.settings,
                            slippagePreset: preset,
                            slippage:
                                preset === 'custom' ? state.settings.slippage : parseFloat(preset),
                        },
                    })),

                setDeadlineMinutes: (minutes) =>
                    set((state) => ({
                        settings: {
                            ...state.settings,
                            deadlineMinutes: minutes,
                        },
                    })),

                setExpertMode: (enabled) =>
                    set((state) => ({
                        settings: {
                            ...state.settings,
                            expertMode: enabled,
                        },
                    })),

                setAutoSelectBestDex: (enabled) =>
                    set((state) => ({
                        settings: {
                            ...state.settings,
                            autoSelectBestDex: enabled,
                        },
                    })),

                // Swap tokens (reverse)
                swapTokens: () =>
                    set((state) => ({
                        tokenIn: state.tokenOut,
                        tokenOut: state.tokenIn,
                        amountIn: state.amountOut,
                        amountOut: state.amountIn,
                        quote: null,
                    })),

                setIsUpdatingFromUrl: (updating) => set({ isUpdatingFromUrl: updating }),

                // Multi-DEX quotes actions
                setDexQuotes: (quotes) => set({ dexQuotes: quotes }),
                setBestQuoteDex: (dexId) => set({ bestQuoteDex: dexId }),
                clearDexQuotes: () => set({ dexQuotes: {}, bestQuoteDex: null }),

                // Reset to initial state
                reset: () => set(initialState),
            }),
            {
                name: 'junoswap-swap-store',
                // Only persist settings, not the current swap state
                partialize: (state) => ({
                    settings: state.settings,
                }),
                // CRITICAL: Merge persisted settings with defaults to handle new fields
                merge: (persistedState, currentState) => {
                    const persisted = persistedState as Partial<SwapStore>
                    return {
                        ...currentState,
                        // Deep merge settings to include new fields from defaults
                        settings: {
                            ...defaultSettings, // Start with defaults (includes new fields)
                            ...persisted.settings, // Override with persisted values
                        },
                    }
                },
            }
        ),
        { name: 'junoswap-swap' }
    )
)

// Selectors for commonly used values
export const useSwapSettings = () => useSwapStore((state) => state.settings)
export const useSwapTokens = () =>
    useSwapStore((state) => ({ tokenIn: state.tokenIn, tokenOut: state.tokenOut }))
export const useSwapAmounts = () =>
    useSwapStore((state) => ({ amountIn: state.amountIn, amountOut: state.amountOut }))
export const useDexQuotes = () => useSwapStore((state) => state.dexQuotes)
export const useBestQuoteDex = () => useSwapStore((state) => state.bestQuoteDex)
export const useAutoSelectBestDex = () => useSwapStore((state) => state.settings.autoSelectBestDex)
