import {
    createPublicClient,
    decodeAbiParameters,
    decodeFunctionData,
    formatEther,
    getAddress,
    http,
    numberToHex,
    parseAbiItem,
    parseAbiParameters,
    type Address,
    type Hash,
    type Log,
} from 'viem'
import { bitkub } from '@/lib/wagmi'
import { resolveLaunchpadLogo } from '@/lib/logo'
import type { LaunchToken } from '@/types/launchpad'

/**
 * Durianfun bonding-curve launchpad factories on KUB Chain — addresses recovered from
 * their frontend bundle (unverified on kubscan, see launchpad-aggregator/reference/RECON.md
 * and sc.md). Durianfun ships new factory versions over time (V5 showed up after the
 * initial recon); until an indexer watches for new deployments, this list needs a manual
 * re-check against their site periodically.
 */
export const DURIANFUN_FACTORIES: Address[] = [
    '0xdf4f3dB298A9aDe853191F58b4b2a322D47EC005', // V4.5
    '0x89b6b73BD18dbEA0e2218c25c1963fd5FBaB3c87', // V4.6.6
    '0x0480017E51dC813a0fad8aA73EAb2f8476ac0e8F', // V4.6.7
    '0xeadEc9dA89F97Ae6215362EBA4B33F3F1d1775b2', // V4.2
    '0xa1000BB39f36a630F1AB1b245B25Ca75a6744Aa5', // FACTORY_D (TARGET_DURIAN)
    '0x96D0117DE988C20f4E4D4B27b46351D760b99D97', // FACTORY_D_V2_4_2
    '0xE3861e300043d8c20A927340cbA6379D0BECb793', // DuriandotfunFactoryV5
]

/**
 * Earliest block worth scanning for TokenCreated, with margin. `fromBlock: 'earliest'`
 * times out on rpc.bitkubchain.io (504 after ~7s scanning from genesis) — found by
 * bisecting eth_getLogs fromBlock on 2026-09-16; the earliest real log sits at block
 * 32,309,877, and 28,000,000 still returns the identical full set in well under 1s.
 * ponytail: re-bisect (or drop this margin) if Durianfun's earliest factory ever changes.
 */
const DURIANFUN_LOGS_START_BLOCK = 28_000_000n

// token/market/creator are indexed (confirmed against a real TokenCreated tx receipt:
// 0x9fdec110cf4558e08b672d81f164665a4c1d86a39c11911f8aaee53929f8a15f has 4 topics,
// with topic0 the signature hash and topics[1..3] these three addresses). Declaring them
// non-indexed still matches on topic0 (indexed-ness isn't part of the signature hash used
// there) but makes viem's arg decode fail — every log silently threw, which was the real
// cause of "no third-party tokens" in the UI.
const tokenCreatedEvent = parseAbiItem(
    'event TokenCreated(address indexed token, address indexed market, address indexed creator, string name, string symbol, uint256 totalSupply, uint256 timestamp, uint8 graduationTarget)'
)

/**
 * Durianfun bonding-curve market — one contract per token (proxy to the shared
 * BondingCurveMarketV5 implementation, see sc.md). Recovered from their frontend bundle
 * and confirmed against mainnet: buy/sell/approve all executed for real on KUB Chain
 * (launchpad-aggregator/HANDOFF.md §3). Graduated tokens stop trading here — they move
 * to a Kublerx V3 pool, which the existing aggregator already routes.
 */
export const durianfunMarketAbi = [
    {
        type: 'function',
        name: 'graduated',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'ammPool',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address' }],
    },
    {
        type: 'function',
        name: 'currentPricePerToken',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'quoteBuy',
        stateMutability: 'view',
        inputs: [{ name: 'kubIn', type: 'uint256' }],
        outputs: [
            { name: 'tokensOut', type: 'uint256' },
            { name: 'actualKubUsed', type: 'uint256' },
            { name: 'feeKub', type: 'uint256' },
            { name: 'refundKub', type: 'uint256' },
            { name: 'willGraduate', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'quoteSell',
        stateMutability: 'view',
        inputs: [{ name: 'tokenIn', type: 'uint256' }],
        outputs: [
            { name: 'kubOut', type: 'uint256' },
            { name: 'feeKub', type: 'uint256' },
            { name: 'executable', type: 'bool' },
            { name: 'reason', type: 'string' },
        ],
    },
    {
        type: 'function',
        name: 'swapExactKubForTokens',
        stateMutability: 'payable',
        inputs: [
            { name: 'minTokensOut', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'referrer', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ name: 'tokensOut', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'swapExactTokensForKub',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenAmountIn', type: 'uint256' },
            { name: 'minKubOut', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'referrer', type: 'address' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [{ name: 'kubOut', type: 'uint256' }],
    },
] as const

/** Durianfun tokens are plain ERC20 (proven on mainnet — see HANDOFF §3), not KAP20. */
export const durianfunErc20Abi = [
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [{ type: 'address' }, { type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [{ type: 'address' }, { type: 'uint256' }],
        outputs: [{ type: 'bool' }],
    },
] as const

const marketAbi = durianfunMarketAbi

export interface DurianfunToken {
    address: Address
    market: Address
    factory: Address
    creator: Address
    name: string
    symbol: string
    totalSupply: bigint
    createdTime: number
    graduationTarget: number
    platform: 'durianfun'
    /** The creation tx — TokenCreated doesn't emit imageUrl, only the createToken() calldata has it. */
    txHash: Hash
}

type TokenCreatedLog = Log<bigint, number, false, typeof tokenCreatedEvent>

/** Pure: raw TokenCreated log -> DurianfunToken, or null if the log is missing an arg. Exported for testing. */
export function parseTokenCreatedLog(log: TokenCreatedLog): DurianfunToken | null {
    if (!log.args) return null
    const { token, market, creator, name, symbol, totalSupply, timestamp, graduationTarget } =
        log.args
    if (!token || !market || !creator || name === undefined || symbol === undefined) return null
    return {
        address: token,
        market,
        factory: log.address,
        creator,
        name,
        symbol,
        totalSupply: totalSupply ?? 0n,
        createdTime: Number(timestamp ?? 0n),
        graduationTarget: graduationTarget ?? 0,
        platform: 'durianfun',
        txHash: log.transactionHash,
    }
}

let client: ReturnType<typeof createPublicClient> | undefined

function getClient() {
    // batch: true coalesces the per-token getTransaction calls in fetchDurianfunLogos into a
    // single JSON-RPC batch request instead of one HTTP round trip per token.
    return (client ??= createPublicClient({
        chain: bitkub,
        transport: http(undefined, { batch: true }),
    }))
}

/**
 * Reads every Durianfun token straight from chain (TokenCreated logs across all known
 * factories) — no dependency on feed.durianfun.xyz. Only KUB Chain mainnet has Durianfun.
 */
export async function fetchDurianfunTokens(chainId: number): Promise<DurianfunToken[]> {
    if (chainId !== bitkub.id) return []

    const logs = await getClient().getLogs({
        address: DURIANFUN_FACTORIES,
        event: tokenCreatedEvent,
        fromBlock: DURIANFUN_LOGS_START_BLOCK,
        toBlock: 'latest',
    })

    const tokens: DurianfunToken[] = []
    for (const log of logs) {
        const token = parseTokenCreatedLog(log)
        if (token) tokens.push(token)
    }
    return tokens
}

export interface DurianfunGraduationStatus {
    graduated: boolean
    ammPool: Address | null
    /** Wei-scaled KUB price per whole token. Frozen at the curve's last tick once
     *  graduated — ponytail: swap to reading the Kublerx pool if that drift matters. */
    currentPricePerToken: bigint
}

const READS_PER_TOKEN = 3

// viem's bundled `bitkub` chain definition omits `contracts.multicall3`, so
// publicClient.multicall() throws immediately — even though Multicall3 is deployed on KUB
// chain mainnet at the standard deterministic address. Pass it explicitly.
const MULTICALL3_ADDRESS: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

/** Batches `graduated()` + `ammPool()` + `currentPricePerToken()` reads via multicall. */
export async function fetchDurianfunGraduationStatus(
    tokens: Pick<DurianfunToken, 'market'>[]
): Promise<DurianfunGraduationStatus[]> {
    if (tokens.length === 0) return []

    const results = await getClient().multicall({
        multicallAddress: MULTICALL3_ADDRESS,
        contracts: tokens.flatMap((t) => [
            { address: t.market, abi: marketAbi, functionName: 'graduated' } as const,
            { address: t.market, abi: marketAbi, functionName: 'ammPool' } as const,
            { address: t.market, abi: marketAbi, functionName: 'currentPricePerToken' } as const,
        ]),
    })

    const statuses: DurianfunGraduationStatus[] = []
    for (let i = 0; i < tokens.length; i++) {
        const graduatedResult = results[i * READS_PER_TOKEN]
        const ammPoolResult = results[i * READS_PER_TOKEN + 1]
        const priceResult = results[i * READS_PER_TOKEN + 2]
        statuses.push({
            graduated:
                graduatedResult?.status === 'success' ? (graduatedResult.result as boolean) : false,
            ammPool: ammPoolResult?.status === 'success' ? (ammPoolResult.result as Address) : null,
            currentPricePerToken:
                priceResult?.status === 'success' ? (priceResult.result as bigint) : 0n,
        })
    }
    return statuses
}

// Kublerx V3 — where graduated Durianfun tokens land (same addresses the Junoswap
// aggregator's own dex-registry already uses; see launchpad-aggregator/reference/RECON.md).
const KUBLERX_QUOTER: Address = '0x63661462C66f13eD121f394Dc57726c1c33672de'
const KKUB: Address = '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5'
// Verified against real graduated Durianfun pools (matched GeckoTerminal mcap) -- the SDK's
// dex-registry "defaultFeeTier" for kublerx (500) is a generic UI default, not what Durianfun's
// bonding-curve auto-graduation actually locks into.
export const KUBLERX_POOL_FEE = 3000

const quoterV2Abi = [
    {
        type: 'function',
        name: 'quoteExactInputSingle',
        stateMutability: 'view',
        inputs: [
            {
                type: 'tuple',
                name: 'params',
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
            },
        ],
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'sqrtPriceX96After', type: 'uint160' },
            { name: 'initializedTicksCrossed', type: 'uint32' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
    },
] as const

/**
 * Live spot price (KUB-wei per whole token) for graduated tokens, read from the Kublerx V3
 * pool via its quoter — `currentPricePerToken()` on the bonding curve market freezes at the
 * moment of graduation and drifts from the real price as the AMM trades (confirmed against
 * GeckoTerminal: the frozen-price market cap was ~4.3x the real one for a graduated token).
 * Best-effort per token; a token whose quote reverts (e.g. no liquidity) just keeps whatever
 * price fetchDurianfunGraduationStatus already had.
 */
export async function fetchGraduatedTokenPrices(
    tokens: Pick<DurianfunToken, 'address'>[]
): Promise<Map<string, bigint>> {
    const prices = new Map<string, bigint>()
    if (tokens.length === 0) return prices

    const results = await getClient().multicall({
        multicallAddress: MULTICALL3_ADDRESS,
        contracts: tokens.map(
            (t) =>
                ({
                    address: KUBLERX_QUOTER,
                    abi: quoterV2Abi,
                    functionName: 'quoteExactInputSingle',
                    args: [
                        {
                            tokenIn: t.address,
                            tokenOut: KKUB,
                            amountIn: 10n ** 18n,
                            fee: KUBLERX_POOL_FEE,
                            sqrtPriceLimitX96: 0n,
                        },
                    ],
                }) as const
        ),
    })

    for (let i = 0; i < tokens.length; i++) {
        const result = results[i]
        if (result?.status === 'success') {
            prices.set(tokens[i]!.address.toLowerCase(), result.result[0])
        }
    }
    return prices
}

// Factory createToken() calldata carries imageUrl — TokenCreated itself doesn't emit it
// (confirmed against a real tx: 0x9fdec110...f8a15f decodes to
// ["Sawadikub", "LSK", "https://pub-...r2.dev/....webp", 0x0, 1]).
const createTokenAbi = [
    parseAbiItem(
        'function createToken(string tokenName, string tokenSymbol, string imageUrl, address referrer, uint8 graduationTarget) payable returns (address, address)'
    ),
]

/**
 * Decodes imageUrl out of each token's createToken() creation tx. Best-effort per token —
 * a factory version with a different createToken shape just yields no logo for that token
 * rather than failing the whole batch.
 * ponytail: rpc.bitkubchain.io can serve a log at an old block but fail
 * eth_getTransactionByHash for that same block's tx ("could not be found") — verified this
 * against real tx hashes the node's own getLogs just returned. Recently-created tokens
 * resolve fine; older ones silently get no logo. No workaround without a different RPC/an
 * archive endpoint.
 */
export async function fetchDurianfunLogos(
    tokens: Pick<DurianfunToken, 'address' | 'txHash'>[]
): Promise<Map<string, string>> {
    const logos = new Map<string, string>()
    if (tokens.length === 0) return logos

    const results = await Promise.all(
        tokens.map(async (t) => {
            try {
                const tx = await getClient().getTransaction({ hash: t.txHash })
                const { args } = decodeFunctionData({ abi: createTokenAbi, data: tx.input })
                return [t.address, args[2]] as const
            } catch {
                return null
            }
        })
    )
    for (const result of results) {
        if (result) logos.set(result[0].toLowerCase(), resolveLaunchpadLogo(result[1]))
    }
    return logos
}

export interface DurianfunSwapEvent {
    blockNumber: bigint
    timestamp: number
    sender: Address
    isBuy: boolean
    amountIn: bigint // KUB (buy) or token (sell), matches tx.value / the Transfer amount
    amountOut: bigint // token (buy) or KUB (sell)
    transactionHash: Hash
}

// The market's Buy/Sell events aren't named/typed anywhere public, so the topic0 hashes below
// were recovered directly from real tx receipts rather than derived from a guessed event
// signature (a guessed name -> wrong keccak256 topic0 -> getLogs silently matches nothing).
// Buy:  0xf9ca77bc...ac6a7b (5 uint256 words: kubIn, tokensOut, fee, arg3, arg4) --
//       field[0] verified == tx.value (1e16), field[1] verified == the paired Transfer amount.
// Sell: 0x95f7a1fa...27c5ec1 (5 uint256 words: tokenIn, kubOut, fee, arg3, arg4) --
//       field[0] verified == the paired Transfer amount.
const BOUGHT_TOPIC0 = '0x6a7381bdc8f4e7ed3c0f0c299382777bde88a65f0c27f670235401d154454630' as const
const SOLD_TOPIC0 = '0x0db49c84bba47806cd98c426100d458b5859594553fc51f0ce13852e9e1ca1c9' as const
const swapDataAbi = parseAbiParameters('uint256, uint256, uint256, uint256, uint256')

interface RawSwapLog {
    args: { sender?: Address; amountIn?: bigint; amountOut?: bigint }
    blockNumber: bigint | null
    transactionHash: Hash | null
}

// eth_getLogs JSON-RPC response shape (all hex strings) -- viem's typed getLogs action doesn't
// expose a raw-topics filter, so these are fetched via a direct client.request call instead.
interface RpcLogEntry {
    blockNumber: Hash | null
    transactionHash: Hash | null
    topics: Hash[]
    data: Hash
}

function decodeSwapLog(log: RpcLogEntry): RawSwapLog {
    const blockNumber = log.blockNumber ? BigInt(log.blockNumber) : null
    if (blockNumber === null || log.transactionHash === null || !log.topics[1]) {
        return { args: {}, blockNumber, transactionHash: log.transactionHash }
    }
    try {
        const [amountIn, amountOut] = decodeAbiParameters(swapDataAbi, log.data)
        return {
            args: {
                sender: getAddress(`0x${log.topics[1].slice(-40)}`),
                amountIn,
                amountOut,
            },
            blockNumber,
            transactionHash: log.transactionHash,
        }
    } catch {
        return { args: {}, blockNumber, transactionHash: log.transactionHash }
    }
}

/**
 * Pure: decoded Bought/Sold logs + a resolved block->timestamp map -> DurianfunSwapEvent,
 * newest first. A block missing from `timestamps` yields timestamp 0 rather than dropping the
 * trade. Exported for testing.
 */
export function mapDurianfunSwapLogs(
    boughtLogs: readonly RawSwapLog[],
    soldLogs: readonly RawSwapLog[],
    timestamps: ReadonlyMap<bigint, number>
): DurianfunSwapEvent[] {
    const events: DurianfunSwapEvent[] = []
    for (const [logs, isBuy] of [
        [boughtLogs, true],
        [soldLogs, false],
    ] as const) {
        for (const log of logs) {
            if (
                !log.args.sender ||
                log.args.amountIn === undefined ||
                log.args.amountOut === undefined
            )
                continue
            if (log.blockNumber === null || log.transactionHash === null) continue
            events.push({
                blockNumber: log.blockNumber,
                timestamp: timestamps.get(log.blockNumber) ?? 0,
                sender: log.args.sender,
                isBuy,
                amountIn: log.args.amountIn,
                amountOut: log.args.amountOut,
                transactionHash: log.transactionHash,
            })
        }
    }
    events.sort((a, b) =>
        a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0
    )
    return events
}

/**
 * Reads a single Durianfun market's Bought/Sold history straight from chain -- these tokens
 * (pre-graduation) aren't indexed anywhere else. `sender` is the event's own indexed address,
 * which is the router/aggregator contract for a routed trade rather than the end wallet (same
 * caveat useTokenSwapEvents documents for v3 swaps) -- good enough for a trade feed, not a
 * per-wallet portfolio view.
 */
export async function fetchDurianfunMarketSwaps(market: Address): Promise<DurianfunSwapEvent[]> {
    const client = getClient()
    const fromBlockHex = numberToHex(DURIANFUN_LOGS_START_BLOCK)
    // eth_getLogs with a raw topics filter isn't exposed by viem's typed getLogs action --
    // call the transport directly instead.
    const request = client.request.bind(client) as (args: {
        method: 'eth_getLogs'
        params: [{ address: Address; topics: Hash[]; fromBlock: Hash; toBlock: 'latest' }]
    }) => Promise<RpcLogEntry[]>
    const [boughtLogsRaw, soldLogsRaw] = await Promise.all([
        request({
            method: 'eth_getLogs',
            params: [
                {
                    address: market,
                    topics: [BOUGHT_TOPIC0],
                    fromBlock: fromBlockHex,
                    toBlock: 'latest',
                },
            ],
        }),
        request({
            method: 'eth_getLogs',
            params: [
                {
                    address: market,
                    topics: [SOLD_TOPIC0],
                    fromBlock: fromBlockHex,
                    toBlock: 'latest',
                },
            ],
        }),
    ])
    const boughtLogs = boughtLogsRaw.map(decodeSwapLog)
    const soldLogs = soldLogsRaw.map(decodeSwapLog)

    const blockNumbers = new Set<bigint>()
    for (const log of [...boughtLogs, ...soldLogs]) {
        if (log.blockNumber !== null) blockNumbers.add(log.blockNumber)
    }
    const timestamps = new Map<bigint, number>()
    await Promise.all(
        Array.from(blockNumbers).map(async (blockNumber) => {
            try {
                const block = await client.getBlock({ blockNumber })
                timestamps.set(blockNumber, Number(block.timestamp))
            } catch {
                // ponytail: leave unresolved blocks at timestamp 0 rather than dropping the trade
            }
        })
    )

    return mapDurianfunSwapLogs(boughtLogs, soldLogs, timestamps)
}

/** Pure: DurianfunToken (+ optional on-chain status/logo/live price) -> LaunchToken + native-KUB market cap. Exported for testing. */
export function toLaunchpadEntry(
    token: DurianfunToken,
    status?: DurianfunGraduationStatus,
    logo?: string,
    livePrice?: bigint
): { token: LaunchToken; marketCapNative: string } {
    const price = livePrice ?? status?.currentPricePerToken
    const priceNative = price ? Number(formatEther(price)) : 0
    const supplyNative = Number(formatEther(token.totalSupply))
    const marketCap = priceNative > 0 ? priceNative * supplyNative : 0

    return {
        token: {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logo: logo ?? '',
            description: '',
            link1: '',
            link2: '',
            link3: '',
            link4: '',
            creator: token.creator,
            createdTime: token.createdTime,
            chainId: bitkub.id,
            isGraduated: status?.graduated ?? false,
            graduatedAt: null,
            platform: 'durianfun',
            market: token.market,
        },
        marketCapNative: marketCap > 0 ? String(marketCap) : '0',
    }
}
