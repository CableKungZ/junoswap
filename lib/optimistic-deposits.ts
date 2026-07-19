/**
 * Bridges the gap between a confirmed stake/unstake tx and the indexer picking up the staker's
 * DepositTransferred. Deliberately in-memory and short-lived: the previous localStorage version
 * outlived the truth it was approximating, which is why the hook reading it had to validate every
 * cached id with an on-chain deposits() batch. An entry here is dropped as soon as the indexer
 * agrees, or when it expires, whichever comes first.
 */

const TTL_MS = 60_000

type Pending = { staked: boolean; expiresAt: number }

const pending = new Map<string, Pending>()
const listeners = new Set<() => void>()
let revision = 0

function key(chainId: number, owner: string, tokenId: bigint): string {
    return `${chainId}-${owner.toLowerCase()}-${tokenId}`
}

function emit() {
    revision++
    listeners.forEach((l) => l())
}

export function subscribeOptimisticDeposits(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** Snapshot for useSyncExternalStore — a counter, since the pending set itself isn't referentially stable. */
export function getOptimisticDepositsRevision(): number {
    return revision
}

function mark(chainId: number, owner: string, tokenId: bigint, staked: boolean) {
    pending.set(key(chainId, owner, tokenId), { staked, expiresAt: Date.now() + TTL_MS })
    emit()
}

export function markStaked(chainId: number, owner: string, tokenId: bigint) {
    mark(chainId, owner, tokenId, true)
}

export function markUnstaked(chainId: number, owner: string, tokenId: bigint) {
    mark(chainId, owner, tokenId, false)
}

/**
 * Folds pending entries into the indexer's answer. An entry that the indexer already reflects is
 * settled and cleared, so the overlay stops influencing the result the moment it's redundant.
 */
export function applyOptimisticDeposits(
    chainId: number,
    owner: string | undefined,
    indexed: bigint[]
): bigint[] {
    if (!owner || pending.size === 0) return indexed

    const now = Date.now()
    const indexedSet = new Set(indexed.map(String))
    const result = new Set(indexed.map(String))
    let settled = false

    for (const [k, entry] of pending) {
        const prefix = `${chainId}-${owner.toLowerCase()}-`
        if (!k.startsWith(prefix)) continue

        const tokenId = k.slice(prefix.length)
        if (entry.expiresAt <= now || indexedSet.has(tokenId) === entry.staked) {
            pending.delete(k)
            settled = true
            continue
        }
        if (entry.staked) result.add(tokenId)
        else result.delete(tokenId)
    }

    if (settled) queueMicrotask(emit)
    return Array.from(result).map(BigInt)
}

/** Test seam — the module-level map otherwise leaks between cases. */
export function __resetOptimisticDeposits() {
    pending.clear()
    listeners.clear()
}
