import { createPublicClient, formatEther, http, parseAbiItem, type Address, type Log } from 'viem'
import { bitkub } from '@/lib/wagmi'
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

const tokenCreatedEvent = parseAbiItem(
    'event TokenCreated(address token, address market, address creator, string name, string symbol, uint256 totalSupply, uint256 timestamp, uint8 graduationTarget)'
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
}

type TokenCreatedLog = Log<bigint, number, false, typeof tokenCreatedEvent>

/** Pure: raw TokenCreated log -> DurianfunToken, or null if the log is missing an arg. Exported for testing. */
export function parseTokenCreatedLog(log: TokenCreatedLog): DurianfunToken | null {
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
    }
}

let client: ReturnType<typeof createPublicClient> | undefined

function getClient() {
    return (client ??= createPublicClient({ chain: bitkub, transport: http() }))
}

/**
 * Reads every Durianfun token straight from chain (TokenCreated logs across all known
 * factories) — no dependency on feed.durianfun.xyz. Only KUB Chain mainnet has Durianfun.
 * ponytail: single getLogs call over the full block range; some RPCs cap the range —
 * chunk by block window if rpc.bitkubchain.io starts rejecting this.
 */
export async function fetchDurianfunTokens(chainId: number): Promise<DurianfunToken[]> {
    if (chainId !== bitkub.id) return []

    const logs = await getClient().getLogs({
        address: DURIANFUN_FACTORIES,
        event: tokenCreatedEvent,
        fromBlock: 'earliest',
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

/** Batches `graduated()` + `ammPool()` + `currentPricePerToken()` reads via multicall. */
export async function fetchDurianfunGraduationStatus(
    tokens: Pick<DurianfunToken, 'market'>[]
): Promise<DurianfunGraduationStatus[]> {
    if (tokens.length === 0) return []

    const results = await getClient().multicall({
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

/** Pure: DurianfunToken (+ optional on-chain status) -> LaunchToken + native-KUB market cap. Exported for testing. */
export function toLaunchpadEntry(
    token: DurianfunToken,
    status?: DurianfunGraduationStatus
): { token: LaunchToken; marketCapNative: string } {
    const priceNative = status ? Number(formatEther(status.currentPricePerToken)) : 0
    const supplyNative = Number(formatEther(token.totalSupply))
    const marketCap = priceNative > 0 ? priceNative * supplyNative : 0

    return {
        token: {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logo: '',
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
