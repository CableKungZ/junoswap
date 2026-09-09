/**
 * Shared plumbing for the on-chain e2e scripts. These talk to a real testnet with a real key, so
 * everything here is deliberately loud: every transaction prints its hash, every check prints what
 * it compared, and a failure never silently rolls on to a step that depends on it.
 */
import {
    createPublicClient,
    createWalletClient,
    defineChain,
    formatUnits,
    http,
    parseUnits,
    type Abi,
    type Address,
    type Hex,
    type PublicClient,
    type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export type { Address, Hex } from 'viem'

export const KUB_TESTNET = defineChain({
    id: 25925,
    name: 'KUB Testnet',
    nativeCurrency: { name: 'KUB', symbol: 'tKUB', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc-testnet.bitkubchain.io'] } },
    blockExplorers: { default: { name: 'Kubscan', url: 'https://testnet.kubscan.com' } },
})

export function env(name: string): string | undefined {
    const value = process.env[name]
    return value && value.length > 0 ? value : undefined
}

export function requireEnv(name: string): string {
    const value = env(name)
    if (!value) throw new Error(`Missing ${name} — see scripts/e2e/README.md`)
    return value
}

export function requireAddress(name: string): Address {
    const value = requireEnv(name)
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} is not an address: ${value}`)
    return value as Address
}

export function optionalAddress(name: string): Address | undefined {
    const value = env(name)
    if (!value) return undefined
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} is not an address: ${value}`)
    return value as Address
}

export function envNumber(name: string, fallback: number): number {
    const value = env(name)
    if (!value) return fallback
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`${name} is not a number: ${value}`)
    return parsed
}

export interface Ctx {
    publicClient: PublicClient
    walletClient: WalletClient
    account: Address
    explorer: string
}

export function makeCtx(keyEnv = 'PRIVATE_KEY'): Ctx {
    const key = requireEnv(keyEnv)
    const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as Hex)
    const rpc = env('RPC_URL') ?? KUB_TESTNET.rpcUrls.default.http[0]
    const transport = http(rpc)
    return {
        publicClient: createPublicClient({ chain: KUB_TESTNET, transport }),
        walletClient: createWalletClient({ account, chain: KUB_TESTNET, transport }),
        account: account.address,
        explorer: KUB_TESTNET.blockExplorers.default.url,
    }
}

/** A second signer, when one is configured. Lets a script drive both sides of a transfer. */
export function optionalCtx(keyEnv: string): Ctx | undefined {
    return env(keyEnv) ? makeCtx(keyEnv) : undefined
}

/* ------------------------------------------------------------------ reporting */

const results: { name: string; ok: boolean; detail?: string }[] = []
let stepIndex = 0

export function log(message: string) {
    console.log(message)
}

export function info(label: string, value: string | number | bigint | boolean) {
    console.log(`      ${label}: ${value}`)
}

/**
 * Runs one named step. A thrown error is recorded and rethrown when `fatal`, so a broken setup
 * stops the run instead of cascading into a hundred misleading failures.
 */
export async function step<T>(
    name: string,
    fn: () => Promise<T>,
    { fatal = true }: { fatal?: boolean } = {}
): Promise<T | undefined> {
    stepIndex += 1
    console.log(`\n[${String(stepIndex).padStart(2, '0')}] ${name}`)
    try {
        const value = await fn()
        results.push({ name, ok: true })
        console.log(`      PASS`)
        return value
    } catch (error) {
        const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
        results.push({ name, ok: false, detail })
        console.log(`      FAIL — ${detail}`)
        if (fatal) throw error
        return undefined
    }
}

/** Records an abort that happened outside a step, so a bad setup cannot exit 0. */
export function failRun(error: unknown) {
    const last = results[results.length - 1]
    if (last && !last.ok) return
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    results.push({ name: 'run aborted before finishing', ok: false, detail })
}

export function summary(): never {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${'='.repeat(72)}`)
    for (const r of results) {
        console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
    }
    console.log(`${'='.repeat(72)}`)
    console.log(`${results.length - failed.length}/${results.length} passed`)
    process.exit(failed.length === 0 ? 0 : 1)
}

export function check(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
    console.log(`      ok — ${message}`)
}

export function checkEqual(actual: unknown, expected: unknown, label: string) {
    const a = typeof actual === 'bigint' ? actual.toString() : String(actual)
    const b = typeof expected === 'bigint' ? expected.toString() : String(expected)
    if (a.toLowerCase() !== b.toLowerCase()) {
        throw new Error(`${label}: expected ${b}, got ${a}`)
    }
    console.log(`      ok — ${label} = ${a}`)
}

/** Compares two amounts within a percentage tolerance, for values that drift with block time. */
export function checkClose(actual: bigint, expected: bigint, tolerancePct: number, label: string) {
    const diff = actual > expected ? actual - expected : expected - actual
    const allowed = (expected * BigInt(Math.round(tolerancePct * 100))) / 10_000n
    if (expected === 0n ? actual !== 0n : diff > allowed) {
        throw new Error(
            `${label}: expected ~${expected}, got ${actual} (off by ${diff}, allowed ${allowed})`
        )
    }
    const offPct = expected === 0n ? 0 : (Number(diff) / Number(expected)) * 100
    console.log(`      ok — ${label} = ${actual} vs ${expected} (${offPct.toFixed(2)}% off)`)
}

/** Asserts that a call reverts. Used for the guards the contracts are supposed to enforce. */
export async function checkReverts(fn: () => Promise<unknown>, label: string) {
    try {
        await fn()
    } catch (error) {
        const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
        console.log(`      ok — ${label} reverted (${detail})`)
        return
    }
    throw new Error(`${label} was expected to revert but succeeded`)
}

/* ------------------------------------------------------------------ chain I/O */

type WriteRequest = Parameters<WalletClient['writeContract']>[0]
type SimulateParams = Parameters<PublicClient['simulateContract']>[0]
type ReadParams = Parameters<PublicClient['readContract']>[0]

export interface ContractCall {
    address: Address
    abi: Abi | readonly unknown[]
    functionName: string
    args?: readonly unknown[]
}

/**
 * KUB has no EIP-1559, so every transaction is forced to the legacy type. The account is taken
 * from the wallet client, not from the simulated request: the request carries a bare address,
 * which viem would send to the node to sign (`unknown account`) instead of signing it here.
 */
export async function send(ctx: Ctx, request: unknown, label: string) {
    const base = request as Record<string, unknown>
    // KUB's estimate is tight enough that a state change between the estimate and the block the
    // transaction lands in runs it out of gas — which surfaces as a revert with no reason at all.
    let gas: bigint | undefined
    try {
        const estimate = await ctx.publicClient.estimateContractGas({
            ...base,
            account: ctx.account,
        } as Parameters<PublicClient['estimateContractGas']>[0])
        // A flat cushion, not a multiplier. These pools take a different, more expensive branch once
        // a reward has accrued — an estimate taken a second earlier priced a claim that transfers
        // nothing — but that branch costs tens of thousands of gas, not multiples. A 3x cushion on
        // a 3M-gas pool deployment reserves most of a wallet's balance for gas that is never used.
        const cushioned = estimate + 250_000n
        gas = cushioned > 200_000n ? cushioned : 200_000n
    } catch {
        gas = undefined
    }
    const hash = await ctx.walletClient.writeContract({
        ...base,
        ...(gas ? { gas } : {}),
        account: ctx.walletClient.account,
        type: 'legacy',
    } as WriteRequest)
    console.log(`      tx ${label}: ${ctx.explorer}/tx/${hash}`)
    // The public KUB RPC sometimes stops answering for a while mid-run; the transaction is fine,
    // the node is not. Five minutes with a slow poll rides that out instead of failing the step.
    const receipt = await ctx.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 300_000,
        pollingInterval: 2_000,
        retryCount: 10,
    })
    if (receipt.status !== 'success') {
        // The simulation passed, so something changed before the transaction was mined. Replay the
        // call at the block it failed in — that block is seconds old, so its state is usually still
        // served — and at the head. `gasUsed` at the limit means it simply ran out of gas.
        const replay = async (blockNumber?: bigint) => {
            try {
                await ctx.publicClient.call({
                    ...base,
                    account: ctx.account,
                    ...(blockNumber ? { blockNumber } : {}),
                } as Parameters<PublicClient['call']>[0])
                return 'succeeded on replay'
            } catch (error) {
                const first = error instanceof Error ? error.message.split('\n')[0] : ''
                return first || String(error)
            }
        }
        const atBlock = await replay(receipt.blockNumber)
        const atHead = await replay()
        throw new Error(
            `${label} reverted on chain (${hash}) — gasUsed ${receipt.gasUsed}/${gas ?? 'auto'}; ` +
                `at block ${receipt.blockNumber}: ${atBlock}; at head: ${atHead}`
        )
    }
    return receipt
}

/** simulate → write, so a revert surfaces with its reason before any gas is spent. */
export async function call(ctx: Ctx, params: ContractCall & { label: string }) {
    const { label, ...rest } = params
    const { request, result } = await ctx.publicClient.simulateContract({
        ...rest,
        account: ctx.account,
    } as SimulateParams)
    await send(ctx, request, label)
    return result
}

/** Same as {@link call}, but hands back the receipt so a step can look at `gasUsed`. */
export async function callGas(ctx: Ctx, params: ContractCall & { label: string }) {
    const { label, ...rest } = params
    const { request } = await ctx.publicClient.simulateContract({
        ...rest,
        account: ctx.account,
    } as SimulateParams)
    const receipt = await send(ctx, request, label)
    return receipt.gasUsed
}

export async function read<T>(ctx: Ctx, params: ContractCall): Promise<T> {
    return (await ctx.publicClient.readContract(params as ReadParams)) as T
}

export async function now(ctx: Ctx): Promise<number> {
    const block = await ctx.publicClient.getBlock()
    return Number(block.timestamp)
}

/** Waits for a chain timestamp, printing a countdown so a long epoch does not look like a hang. */
export async function waitUntil(ctx: Ctx, targetSeconds: number, label: string) {
    for (;;) {
        const current = await now(ctx)
        const left = targetSeconds - current
        if (left <= 0) {
            console.log(`      ${label}: reached`)
            return
        }
        console.log(`      ${label}: ${left}s left`)
        await new Promise((resolve) => setTimeout(resolve, Math.min(left, 15) * 1000))
    }
}

export async function sleep(seconds: number, label: string) {
    console.log(`      waiting ${seconds}s — ${label}`)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/* ------------------------------------------------------------------ erc20 */

export const ERC20 = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'decimals',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
    },
    {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
    },
] as const

export interface TokenInfo {
    address: Address
    symbol: string
    decimals: number
}

export async function tokenInfo(ctx: Ctx, address: Address): Promise<TokenInfo> {
    const [symbol, decimals] = await Promise.all([
        read<string>(ctx, { address, abi: ERC20, functionName: 'symbol' }),
        read<number>(ctx, { address, abi: ERC20, functionName: 'decimals' }),
    ])
    return { address, symbol, decimals }
}

export async function balanceOf(ctx: Ctx, token: Address, owner: Address): Promise<bigint> {
    return read<bigint>(ctx, {
        address: token,
        abi: ERC20,
        functionName: 'balanceOf',
        args: [owner],
    })
}

export async function allowanceOf(
    ctx: Ctx,
    token: Address,
    owner: Address,
    spender: Address
): Promise<bigint> {
    return read<bigint>(ctx, {
        address: token,
        abi: ERC20,
        functionName: 'allowance',
        args: [owner, spender],
    })
}

/** Approves only when the current allowance is short, the same way the app does. */
export async function ensureAllowance(
    ctx: Ctx,
    token: Address,
    spender: Address,
    amount: bigint,
    label: string
) {
    const current = await allowanceOf(ctx, token, ctx.account, spender)
    if (current >= amount) {
        console.log(`      allowance already covers ${label}`)
        return
    }
    await call(ctx, {
        address: token,
        abi: ERC20,
        functionName: 'approve',
        args: [spender, amount],
        label: `approve ${label}`,
    })
}

export function fmt(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals)
}

export function parse(amount: string, decimals: number): bigint {
    return parseUnits(amount, decimals)
}
