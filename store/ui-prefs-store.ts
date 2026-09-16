import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiPrefsStore {
    /** Show the step-by-step transaction dialog. Off runs the same flow behind toasts only. */
    txDialogs: boolean
    setTxDialogs: (txDialogs: boolean) => void
}

export const useUiPrefsStore = create<UiPrefsStore>()(
    persist(
        (set) => ({
            txDialogs: false,
            setTxDialogs: (txDialogs) => set({ txDialogs }),
        }),
        { name: 'junoswap-ui-prefs' }
    )
)
