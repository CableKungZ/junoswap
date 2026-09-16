export type TxPhase = 'idle' | 'pending' | 'confirming' | 'success' | 'error' | 'sim-error'

export interface TxFlags {
    /** Wallet prompt is open, or a pre-flight simulate is running. */
    isPending?: boolean
    isConfirming?: boolean
    isSuccess?: boolean
    isError?: boolean
    error?: unknown
    /** A revert caught by simulateContract, before anything was broadcast. */
    simulationError?: unknown
    hash?: `0x${string}`
}

/**
 * Collapses a wagmi execution hook's flags into the one phase the dialog renders.
 *
 * Order matters and is not the obvious one:
 * - `simulationError` only wins while there is no hash, because a stale simulate error
 *   hangs around after a successful retry and would otherwise mask the receipt.
 * - `isSuccess` beats `isConfirming` because `useWaitForTransactionReceipt` can still
 *   report pending on the render where a poll-detected success lands (see useTokenApproval).
 */
export function txPhase(flags: TxFlags): TxPhase {
    if (flags.simulationError && !flags.hash) return 'sim-error'
    if (flags.isError) return 'error'
    if (flags.isSuccess) return 'success'
    if (flags.isConfirming) return 'confirming'
    if (flags.isPending) return 'pending'
    return 'idle'
}

export const isTerminal = (phase: TxPhase): boolean =>
    phase === 'success' || phase === 'error' || phase === 'sim-error'

export const isBusy = (phase: TxPhase): boolean => phase === 'pending' || phase === 'confirming'

function errorText(error: unknown): string {
    if (!error) return ''
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    return String(error)
}

/** EIP-1193 rejection, which is a user decision rather than a failure worth a log. */
export function isUserRejection(error: unknown): boolean {
    if (!error) return false
    const code = (error as { code?: unknown }).code
    if (code === 4001 || code === 'ACTION_REJECTED') return true
    return /user rejected|user denied|rejected the request/i.test(errorText(error))
}

/**
 * The headline for a failed transaction: the contract's own revert string where viem
 * decoded one, the wallet's short message otherwise.
 */
export function parseRevertReason(error: unknown): string {
    if (isUserRejection(error)) return 'Transaction rejected in wallet'
    const raw = errorText(error)
    if (!raw) return 'Transaction failed'
    // viem prints the decoded revert on its own `Error:` line, below the call summary.
    const reverted = raw.match(/^Error:\s*(.+)$/m)?.[1]?.trim()
    if (reverted) return reverted
    const short = (error as { shortMessage?: string }).shortMessage
    if (short) return short.trim()
    return raw.split('\n')[0]?.trim() || 'Transaction failed'
}

/** The full text behind the "show log" toggle — everything viem gave us, unmodified. */
export function fullErrorLog(error: unknown): string {
    const err = error as { message?: string; details?: string; metaMessages?: string[] }
    if (!err) return ''
    const parts = [errorText(error)]
    if (err.details && !parts[0]?.includes(err.details)) parts.push(`Details: ${err.details}`)
    return parts.filter(Boolean).join('\n\n')
}

/**
 * Eased progress of a count-up, kept pure so the hook around it stays a thin
 * requestAnimationFrame wrapper with nothing to test.
 */
export function countValue(to: number, elapsed: number, duration: number): number {
    if (duration <= 0 || !Number.isFinite(to)) return to
    const t = Math.min(1, Math.max(0, elapsed / duration))
    return to * (1 - Math.pow(1 - t, 3))
}
