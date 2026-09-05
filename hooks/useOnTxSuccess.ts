'use client'

import { useEffect, useRef } from 'react'

/**
 * Runs `onSuccess` once per confirmed transaction, for dialogs that stay mounted between opens.
 *
 * wagmi's write hook keeps reporting the last successful hash after a dialog closes, so a plain
 * "have I handled this hash yet" flag reset on open replays the previous success the moment the
 * dialog is reopened. Seeding the marker with whatever hash the hook already holds is what makes
 * reopening safe.
 */
export function useOnTxSuccess(
    open: boolean,
    isSuccess: boolean,
    hash: `0x${string}` | undefined,
    onSuccess: (hash: `0x${string}`) => void
) {
    const handled = useRef<`0x${string}` | null>(null)
    const latestHash = useRef(hash)
    latestHash.current = hash

    useEffect(() => {
        if (open) handled.current = latestHash.current ?? null
    }, [open])

    useEffect(() => {
        if (!open || !isSuccess || !hash || handled.current === hash) return
        handled.current = hash
        onSuccess(hash)
    }, [open, isSuccess, hash, onSuccess])
}
