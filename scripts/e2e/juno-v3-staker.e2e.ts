/**
 * End-to-end exercise of JunoswapV3Staker.
 *
 * Uses one Uniswap-v3 position NFT the runner already owns: creates a short incentive on that
 * position's pool, then walks the whole lifecycle — the createIncentive guards, topping up before
 * the start, depositing the NFT, staking, reward accrual, unstaking, partial and full claiming,
 * finalizeStake after the end, transferDeposit, withdrawing the NFT and refunding the incentive.
 *
 * Read scripts/e2e/README.md first — this spends real testnet tokens and moves a real position NFT.
 */
import { encodeAbiParameters, keccak256, type Hex } from 'viem'
import { JUNO_V3_STAKER_ABI } from '../../lib/abis/juno-v3-staker'
import {
    balanceOf,
    call,
    check,
    checkClose,
    checkEqual,
    checkReverts,
    ensureAllowance,
    envNumber,
    failRun,
    fmt,
    info,
    log,
    makeCtx,
    now,
    optionalAddress,
    optionalCtx,
    parse,
    read,
    requireAddress,
    send,
    sleep,
    step,
    summary,
    tokenInfo,
    waitUntil,
    type Address,
    type Ctx,
} from './shared'

const NFPM_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'tokenOfOwnerByIndex',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        outputs: [{ type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'ownerOf',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ type: 'address' }],
    },
    {
        type: 'function',
        name: 'positions',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [
            { name: 'nonce', type: 'uint96' },
            { name: 'operator', type: 'address' },
            { name: 'token0', type: 'address' },
            { name: 'token1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickLower', type: 'int24' },
            { name: 'tickUpper', type: 'int24' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'feeGrowthInside0LastX128', type: 'uint256' },
            { name: 'feeGrowthInside1LastX128', type: 'uint256' },
            { name: 'tokensOwed0', type: 'uint128' },
            { name: 'tokensOwed1', type: 'uint128' },
        ],
    },
    {
        type: 'function',
        name: 'safeTransferFrom',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'mint',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'token0', type: 'address' },
                    { name: 'token1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'amount0Desired', type: 'uint256' },
                    { name: 'amount1Desired', type: 'uint256' },
                    { name: 'amount0Min', type: 'uint256' },
                    { name: 'amount1Min', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                ],
            },
        ],
        outputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'amount0', type: 'uint256' },
            { name: 'amount1', type: 'uint256' },
        ],
    },
] as const

const V3_FACTORY_ABI = [
    {
        type: 'function',
        name: 'getPool',
        stateMutability: 'view',
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'fee', type: 'uint24' },
        ],
        outputs: [{ type: 'address' }],
    },
] as const

const V3_POOL_ABI = [
    {
        type: 'function',
        name: 'tickSpacing',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'int24' }],
    },
    {
        type: 'function',
        name: 'slot0',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'sqrtPriceX96', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'observationIndex', type: 'uint16' },
            { name: 'observationCardinality', type: 'uint16' },
            { name: 'observationCardinalityNext', type: 'uint16' },
            { name: 'feeProtocol', type: 'uint8' },
            { name: 'unlocked', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'liquidity',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint128' }],
    },
] as const

interface IncentiveKey {
    rewardToken: Address
    pool: Address
    startTime: bigint
    endTime: bigint
    refundee: Address
}

/** The staker keys incentives by keccak256(abi.encode(key)) — the same hash IncentiveId computes. */
function incentiveIdOf(key: IncentiveKey): Hex {
    return keccak256(
        encodeAbiParameters(
            [
                {
                    type: 'tuple',
                    components: [
                        { name: 'rewardToken', type: 'address' },
                        { name: 'pool', type: 'address' },
                        { name: 'startTime', type: 'uint256' },
                        { name: 'endTime', type: 'uint256' },
                        { name: 'refundee', type: 'address' },
                    ],
                },
            ],
            [key]
        )
    )
}

function keyTuple(key: IncentiveKey) {
    return {
        rewardToken: key.rewardToken,
        pool: key.pool,
        startTime: key.startTime,
        endTime: key.endTime,
        refundee: key.refundee,
    }
}

/** Finds a position the staker will actually accept: real liquidity, and currently in range. */
async function pickPosition(ctx: Ctx, nfpm: Address, v3Factory: Address, override?: bigint) {
    const ids: bigint[] = []
    if (override !== undefined) {
        ids.push(override)
    } else {
        const count = await read<bigint>(ctx, {
            address: nfpm,
            abi: NFPM_ABI,
            functionName: 'balanceOf',
            args: [ctx.account],
        })
        for (let i = 0n; i < count && i < 25n; i += 1n) {
            ids.push(
                await read<bigint>(ctx, {
                    address: nfpm,
                    abi: NFPM_ABI,
                    functionName: 'tokenOfOwnerByIndex',
                    args: [ctx.account, i],
                })
            )
        }
    }

    for (const tokenId of ids) {
        const position = await read<readonly unknown[]>(ctx, {
            address: nfpm,
            abi: NFPM_ABI,
            functionName: 'positions',
            args: [tokenId],
        })
        const token0 = position[2] as Address
        const token1 = position[3] as Address
        const fee = Number(position[4])
        const tickLower = Number(position[5])
        const tickUpper = Number(position[6])
        const liquidity = position[7] as bigint
        if (liquidity === 0n) continue

        const pool = await read<Address>(ctx, {
            address: v3Factory,
            abi: V3_FACTORY_ABI,
            functionName: 'getPool',
            args: [token0, token1, fee],
        })
        if (pool === '0x0000000000000000000000000000000000000000') continue

        const slot0 = await read<readonly unknown[]>(ctx, {
            address: pool,
            abi: V3_POOL_ABI,
            functionName: 'slot0',
        })
        const tick = Number(slot0[1])
        const poolLiquidity = await read<bigint>(ctx, {
            address: pool,
            abi: V3_POOL_ABI,
            functionName: 'liquidity',
        })
        const inRange = tick >= tickLower && tick < tickUpper
        if (!inRange) {
            log(
                `      position ${tokenId}: out of range (tick ${tick} vs ${tickLower}..${tickUpper})`
            )
            continue
        }
        if (liquidity > poolLiquidity) {
            log(`      position ${tokenId}: liquidity exceeds the pool's own`)
            continue
        }
        return { tokenId, pool, liquidity, tickLower, tickUpper, tick }
    }
    throw new Error(
        'No in-range position with liquidity found. Mint one on a v3 pool, or set POSITION_ID.'
    )
}

async function main() {
    const ctx = makeCtx()
    const staker = requireAddress('JUNO_STAKER')
    const rewardTokenAddress = requireAddress('REWARD_TOKEN')
    const positionOverride = process.env.POSITION_ID ? BigInt(process.env.POSITION_ID) : undefined
    const position2Override = process.env.POSITION_ID_2
        ? BigInt(process.env.POSITION_ID_2)
        : undefined
    // A second signer lets the deposit be handed over and handed back in the same run; with only
    // SECOND_ADDRESS the transfer is one-way and the NFT stays there.
    const secondCtx = optionalCtx('PRIVATE_KEY_2')
    const secondAccount = secondCtx?.account ?? optionalAddress('SECOND_ADDRESS')

    const leadSeconds = envNumber('LEAD_SECONDS', 45)
    const incentiveSeconds = envNumber('INCENTIVE_SECONDS', 180)
    const rewardText = process.env.REWARD_AMOUNT ?? '10'

    const config = await step('Read the staker configuration', async () => {
        const [v3Factory, nfpm, maxDuration, maxLead] = await Promise.all([
            read<Address>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'factory',
            }),
            read<Address>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'nonfungiblePositionManager',
            }),
            read<bigint>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'maxIncentiveDuration',
            }),
            read<bigint>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'maxIncentiveStartLeadTime',
            }),
        ])
        info('v3 factory', v3Factory)
        info('position manager', nfpm)
        info('maxIncentiveDuration', maxDuration.toString())
        info('maxIncentiveStartLeadTime', maxLead.toString())
        check(BigInt(incentiveSeconds) <= maxDuration, 'requested duration is within the cap')
        check(BigInt(leadSeconds) <= maxLead, 'requested start lead time is within the cap')
        return { v3Factory, nfpm, maxDuration, maxLead }
    })
    if (!config) return summary()

    const rewardToken = await step('Read the reward token', () =>
        tokenInfo(ctx, rewardTokenAddress)
    )
    if (!rewardToken) return summary()
    const reward = parse(rewardText, rewardToken.decimals)

    const position = await step('Pick an in-range position to stake', async () => {
        const found = await pickPosition(ctx, config.nfpm, config.v3Factory, positionOverride)
        info('tokenId', found.tokenId.toString())
        info('pool', found.pool)
        info('liquidity', found.liquidity.toString())
        info('tick', `${found.tick} in ${found.tickLower}..${found.tickUpper}`)
        check(found.liquidity > 0n, 'position has liquidity and is in range')
        return found
    })
    if (!position) return summary()

    const startTime = BigInt((await now(ctx)) + leadSeconds)
    const endTime = startTime + BigInt(incentiveSeconds)
    const key: IncentiveKey = {
        rewardToken: rewardToken.address,
        pool: position.pool,
        startTime,
        endTime,
        refundee: ctx.account,
    }
    const incentiveId = incentiveIdOf(key)
    log(`\nIncentive key: start ${startTime} end ${endTime}\nincentiveId ${incentiveId}`)

    await step('createIncentive rejects a start time in the past', async () => {
        await ensureAllowance(ctx, rewardToken.address, staker, reward * 8n, 'reward budget')
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'createIncentive',
                    args: [
                        keyTuple({ ...key, startTime: BigInt((Date.now() / 1000) | 0) - 600n }),
                        reward,
                    ],
                    account: ctx.account,
                }),
            'a start time in the past'
        )
    })

    await step('createIncentive rejects a duration past the cap', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'createIncentive',
                    args: [
                        keyTuple({ ...key, endTime: startTime + config.maxDuration + 1n }),
                        reward,
                    ],
                    account: ctx.account,
                }),
            'a duration past maxIncentiveDuration'
        )
    })

    await step('createIncentive rejects a zero reward', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'createIncentive',
                    args: [keyTuple(key), 0n],
                    account: ctx.account,
                }),
            'a zero reward'
        )
    })

    // The staker charges nothing and has no owner, so the fee lives in a contract in front of it.
    // This proves the path the app now uses: pay the fee, and the incentive lands on the staker.
    await step(
        'The fee collector charges the creation fee and forwards the reward',
        async () => {
            const collector = optionalAddress('FEE_COLLECTOR')
            if (!collector) {
                check(true, 'FEE_COLLECTOR not set — skipped')
                return
            }
            const collectorAbi = [
                {
                    type: 'function',
                    name: 'fee',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'uint256' }],
                },
                {
                    type: 'function',
                    name: 'treasury',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'address' }],
                },
                {
                    type: 'function',
                    name: 'paidBy',
                    stateMutability: 'view',
                    inputs: [{ type: 'bytes32' }],
                    outputs: [{ type: 'address' }],
                },
                {
                    type: 'function',
                    name: 'createIncentive',
                    stateMutability: 'payable',
                    inputs: [
                        {
                            name: 'key',
                            type: 'tuple',
                            components: [
                                { name: 'rewardToken', type: 'address' },
                                { name: 'pool', type: 'address' },
                                { name: 'startTime', type: 'uint256' },
                                { name: 'endTime', type: 'uint256' },
                                { name: 'refundee', type: 'address' },
                            ],
                        },
                        { name: 'reward', type: 'uint256' },
                    ],
                    outputs: [],
                },
            ] as const

            const fee = await read<bigint>(ctx, {
                address: collector,
                abi: collectorAbi,
                functionName: 'fee',
            })
            // Without the fee in hand the wallet rejects the call before it reaches the contract,
            // which would make the guard below pass for the wrong reason.
            const held = await ctx.publicClient.getBalance({ address: ctx.account })
            if (held < fee + parse('0.05', 18)) {
                check(
                    true,
                    `account holds ${fmt(held, 18)} KUB, needs the ${fmt(fee, 18)} fee plus gas — skipped`
                )
                return
            }
            const treasury = await read<Address>(ctx, {
                address: collector,
                abi: collectorAbi,
                functionName: 'treasury',
            })
            info('fee', `${fmt(fee, 18)} KUB`)
            info('treasury', treasury)

            // Its own key, so this incentive is independent of the one the rest of the run uses.
            const start = (await now(ctx)) + leadSeconds
            const feeKey: IncentiveKey = {
                rewardToken: rewardToken.address,
                pool: position.pool,
                startTime: BigInt(start + 1),
                endTime: BigInt(start + 1 + incentiveSeconds),
                refundee: ctx.account,
            }
            const feeIncentiveId = incentiveIdOf(feeKey)

            const smallReward = reward / 10n
            await ensureAllowance(
                ctx,
                rewardToken.address,
                collector,
                smallReward,
                'reward for the collector'
            )
            const treasuryBefore = await ctx.publicClient.getBalance({ address: treasury })

            await checkReverts(async () => {
                try {
                    await ctx.publicClient.simulateContract({
                        address: collector,
                        abi: collectorAbi,
                        functionName: 'createIncentive',
                        args: [keyTuple(feeKey), smallReward],
                        account: ctx.account,
                        value: fee > 0n ? fee - 1n : 0n,
                    })
                } catch (error) {
                    // Only the contract's own guard counts here: a wallet-side rejection, such
                    // as too little native currency, would otherwise look like a pass.
                    const message = error instanceof Error ? error.message : String(error)
                    if (!message.includes('fee not paid')) {
                        throw new Error(`reverted for another reason: ${message.split('\n')[0]}`)
                    }
                    throw error
                }
            }, 'creating without paying the fee')

            const { request } = await ctx.publicClient.simulateContract({
                address: collector,
                abi: collectorAbi,
                functionName: 'createIncentive',
                args: [keyTuple(feeKey), smallReward],
                account: ctx.account,
                value: fee,
            })
            await send(ctx, request, 'createIncentive through the collector')

            const treasuryAfter = await ctx.publicClient.getBalance({ address: treasury })
            checkEqual(treasuryAfter - treasuryBefore, fee, 'the treasury was paid the fee')
            checkEqual(
                await read<Address>(ctx, {
                    address: collector,
                    abi: collectorAbi,
                    functionName: 'paidBy',
                    args: [feeIncentiveId],
                }),
                ctx.account,
                'the payer is on the registry'
            )
            const state = await read<readonly bigint[]>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'incentives',
                args: [feeIncentiveId],
            })
            checkEqual(state[0], smallReward, 'the whole reward reached the staker')
            checkEqual(
                await balanceOf(ctx, rewardToken.address, collector),
                0n,
                'the collector kept no reward tokens'
            )
            checkEqual(
                await ctx.publicClient.getBalance({ address: collector }),
                0n,
                'the collector kept no native currency'
            )
        },
        { fatal: false }
    )

    await step('Create the incentive', async () => {
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'createIncentive',
            args: [keyTuple(key), reward],
            label: 'createIncentive',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        checkEqual(before - after, reward, 'reward pulled from the creator')
        const state = await read<readonly [bigint, bigint, bigint, bigint, bigint, bigint]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'incentives',
            args: [incentiveId],
        })
        checkEqual(state[0], reward, 'totalReward')
        checkEqual(state[1], reward, 'totalRewardUnclaimed')
        checkEqual(state[5], 0n, 'numberOfStakes')
    })

    await step('Topping up the same incentive before it starts adds to the budget', async () => {
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'createIncentive',
            args: [keyTuple(key), reward],
            label: 'createIncentive top-up',
        })
        const state = await read<readonly [bigint, bigint, bigint, bigint, bigint, bigint]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'incentives',
            args: [incentiveId],
        })
        checkEqual(state[0], reward * 2n, 'totalReward after the top-up')
    })

    // Account 2 deposits and withdraws its own NFT, so the deposit path is proven for a second
    // owner without touching the incentive account 1 is running.
    await step(
        'Account 2 deposits its own position and takes it back',
        async () => {
            if (!secondCtx) {
                check(true, 'PRIVATE_KEY_2 not set — skipped')
                return
            }
            const second = await pickPosition(
                secondCtx,
                config.nfpm,
                config.v3Factory,
                position2Override
            )
            info('account 2 position', second.tokenId)
            await call(secondCtx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'safeTransferFrom',
                args: [secondCtx.account, staker, second.tokenId],
                label: 'safeTransferFrom position (account 2)',
            })
            const deposit = await read<readonly unknown[]>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'deposits',
                args: [second.tokenId],
            })
            checkEqual(deposit[0], secondCtx.account, 'deposit owner is account 2')
            checkEqual(deposit[1], 0n, 'numberOfStakes on a fresh deposit')
            checkEqual(deposit[2], second.tickLower, 'tickLower recorded')
            checkEqual(deposit[3], second.tickUpper, 'tickUpper recorded')
            await checkReverts(
                () =>
                    ctx.publicClient.simulateContract({
                        address: staker,
                        abi: JUNO_V3_STAKER_ABI,
                        functionName: 'withdrawToken',
                        args: [second.tokenId, ctx.account, '0x'],
                        account: ctx.account,
                    }),
                "account 1 withdrawing account 2's deposit"
            )
            await call(secondCtx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'withdrawToken',
                args: [second.tokenId, secondCtx.account, '0x'],
                label: 'withdrawToken (account 2)',
            })
            const owner = await read<Address>(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'ownerOf',
                args: [second.tokenId],
            })
            checkEqual(owner, secondCtx.account, 'NFT back with account 2')
        },
        { fatal: false }
    )

    await step('Deposit the position NFT into the staker', async () => {
        // A run that aborted after depositing leaves the NFT here, so the deposit is only made
        // when the staker is not already holding it for this account.
        const existing = await read<readonly unknown[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'deposits',
            args: [position.tokenId],
        })
        if ((existing[0] as Address).toLowerCase() === ctx.account.toLowerCase()) {
            log('      already deposited by an earlier run — reusing it')
        } else {
            await call(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'safeTransferFrom',
                args: [ctx.account, staker, position.tokenId],
                label: 'safeTransferFrom position',
            })
        }
        const deposit = await read<readonly unknown[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'deposits',
            args: [position.tokenId],
        })
        checkEqual(deposit[0], ctx.account, 'deposit owner')
        checkEqual(deposit[1], 0n, 'numberOfStakes on a fresh deposit')
        checkEqual(deposit[2], position.tickLower, 'tickLower recorded')
        checkEqual(deposit[3], position.tickUpper, 'tickUpper recorded')
    })

    // The eviction path needs a position that is out of range, and no wallet reliably has one, so
    // one is minted on purpose: a range that starts a tick spacing above the current price holds
    // token0 only and is out of range from its first block.
    await step(
        'A deliberately out-of-range position is minted, and the staker refuses to stake it',
        async () => {
            const spacing = Number(
                await read<number>(ctx, {
                    address: position.pool,
                    abi: V3_POOL_ABI,
                    functionName: 'tickSpacing',
                })
            )
            const slot0 = await read<readonly unknown[]>(ctx, {
                address: position.pool,
                abi: V3_POOL_ABI,
                functionName: 'slot0',
            })
            const tick = Number(slot0[1])
            // One spacing clear of the current tick, so a block or two of price drift cannot pull
            // the range back over the price and make the test pass for the wrong reason.
            const tickLower = Math.ceil(tick / spacing) * spacing + spacing
            const tickUpper = tickLower + spacing * 10
            info('pool tick', tick)
            info('minting range', `${tickLower}..${tickUpper} (spacing ${spacing})`)

            // Reuse one from an earlier run rather than minting every time: each mint locks tokens
            // in a position nothing ever collects, and they pile up one per run.
            const held = await read<bigint>(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'balanceOf',
                args: [ctx.account],
            })
            let reused: bigint | undefined
            for (let i = 0n; i < held && i < 25n && reused === undefined; i += 1n) {
                const id = await read<bigint>(ctx, {
                    address: config.nfpm,
                    abi: NFPM_ABI,
                    functionName: 'tokenOfOwnerByIndex',
                    args: [ctx.account, i],
                })
                const p = await read<readonly unknown[]>(ctx, {
                    address: config.nfpm,
                    abi: NFPM_ABI,
                    functionName: 'positions',
                    args: [id],
                })
                const lower = Number(p[5])
                const upper = Number(p[6])
                const liquidity = p[7] as bigint
                if (liquidity > 0n && (tick < lower || tick >= upper)) reused = id
            }

            const details = await read<readonly unknown[]>(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'positions',
                args: [position.tokenId],
            })
            const token0 = details[2] as Address
            const token1 = details[3] as Address
            const fee = Number(details[4])
            // A range entirely above the price is priced in token0 alone, so only token0 is pulled.
            const amount0 = parse(process.env.OUT_OF_RANGE_AMOUNT ?? '0.05', 18)
            await ensureAllowance(ctx, token0, config.nfpm, amount0, 'token0 for the mint')

            const minted = reused
                ? ([reused, 1n, 0n, 0n] as const)
                : ((await call(ctx, {
                      address: config.nfpm,
                      abi: NFPM_ABI,
                      functionName: 'mint',
                      args: [
                          {
                              token0,
                              token1,
                              fee,
                              tickLower,
                              tickUpper,
                              amount0Desired: amount0,
                              amount1Desired: 0n,
                              amount0Min: 0n,
                              amount1Min: 0n,
                              recipient: ctx.account,
                              deadline: BigInt((await now(ctx)) + 600),
                          },
                      ],
                      label: 'mint an out-of-range position',
                  })) as readonly [bigint, bigint, bigint, bigint])
            const outOfRangeId = minted[0]
            info(reused ? 'reusing out-of-range tokenId' : 'minted tokenId', outOfRangeId)
            check(minted[1] > 0n, `position has liquidity = ${minted[1]}`)
            if (!reused) {
                checkEqual(minted[3], 0n, 'no token1 was needed, the range sits above the price')
            }

            await call(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'safeTransferFrom',
                args: [ctx.account, staker, outOfRangeId],
                label: 'deposit the out-of-range position',
            })
            // Depositing is fine; staking is where the staker draws the line. An out-of-range
            // position earns nothing and would only dilute the stakers who are actually in range.
            await checkReverts(
                () =>
                    ctx.publicClient.simulateContract({
                        address: staker,
                        abi: JUNO_V3_STAKER_ABI,
                        functionName: 'stakeToken',
                        args: [keyTuple(key), outOfRangeId],
                        account: ctx.account,
                    }),
                'staking a position that is out of range'
            )
            await call(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'withdrawToken',
                args: [outOfRangeId, ctx.account, '0x'],
                label: 'take the out-of-range position back',
            })
            checkEqual(
                await read<Address>(ctx, {
                    address: config.nfpm,
                    abi: NFPM_ABI,
                    functionName: 'ownerOf',
                    args: [outOfRangeId],
                }),
                ctx.account,
                'out-of-range NFT returned'
            )
            log(
                '      NOTE: eviction (unstakeToken by a stranger) additionally needs a stake that ' +
                    'was in range at stake time and then spent an hour out of it, which takes a ' +
                    'swap to move the price; set OUT_OF_RANGE_AMOUNT to keep this position around.'
            )
        },
        { fatal: false }
    )

    await step('Staking before the start time reverts', async () => {
        // The steps above cost real time, so on a short lead the incentive may already be open by
        // the time this runs — in which case there is no pre-start window left to test.
        if ((await now(ctx)) >= Number(startTime)) {
            check(true, `incentive already started — raise LEAD_SECONDS to exercise this guard`)
            return
        }
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'stakeToken',
                    args: [keyTuple(key), position.tokenId],
                    account: ctx.account,
                }),
            'staking before startTime'
        )
    })

    await step('Stake once the incentive opens', async () => {
        await waitUntil(ctx, Number(startTime) + 2, 'incentive start')
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'stakeToken',
            args: [keyTuple(key), position.tokenId],
            label: 'stakeToken',
        })
        const stake = await read<readonly unknown[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'stakes',
            args: [position.tokenId, incentiveId],
        })
        check((stake[3] as bigint) > 0n, `staked liquidity = ${stake[3]}`)
        checkEqual(stake[5], false, 'not finalized yet')
        const state = await read<readonly bigint[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'incentives',
            args: [incentiveId],
        })
        checkEqual(state[5], 1n, 'numberOfStakes')
        check((state[3] as bigint) > 0n, `stakedLiquidity = ${state[3]}`)
    })

    await step('Staking the same token twice reverts', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'stakeToken',
                    args: [keyTuple(key), position.tokenId],
                    account: ctx.account,
                }),
            'double staking'
        )
    })

    await step('The NFT cannot be withdrawn while it is staked', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'withdrawToken',
                    args: [position.tokenId, ctx.account, '0x'],
                    account: ctx.account,
                }),
            'withdrawing a staked position'
        )
    })

    await step('Rewards accrue for an in-range stake', async () => {
        const first = await read<readonly [bigint, bigint]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'getRewardInfo',
            args: [keyTuple(key), position.tokenId],
        })
        await sleep(30, 'let the incentive accrue')
        const second = await read<readonly [bigint, bigint]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'getRewardInfo',
            args: [keyTuple(key), position.tokenId],
        })
        info('reward before', fmt(first[0], rewardToken.decimals))
        info('reward after', fmt(second[0], rewardToken.decimals))
        info('secondsInsideStaked', second[1].toString())
        check(second[0] > first[0], 'reward grew')
        check(second[1] > first[1], 'in-range seconds grew')
    })

    // Two positions in one incentive: the emission for a given second has to split by liquidity,
    // not go entirely to whoever staked first.
    await step(
        'Two accounts share one incentive by liquidity',
        async () => {
            if (!secondCtx) {
                check(true, 'PRIVATE_KEY_2 not set — skipped')
                return
            }
            const second = await pickPosition(
                secondCtx,
                config.nfpm,
                config.v3Factory,
                position2Override
            )
            if (second.pool.toLowerCase() !== position.pool.toLowerCase()) {
                check(true, `account 2's position is on another pool (${second.pool}) — skipped`)
                return
            }
            await call(secondCtx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'safeTransferFrom',
                args: [secondCtx.account, staker, second.tokenId],
                label: 'deposit position (account 2)',
            })
            await call(secondCtx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'stakeToken',
                args: [keyTuple(key), second.tokenId],
                label: 'stakeToken (account 2)',
            })
            const state = await read<readonly bigint[]>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'incentives',
                args: [incentiveId],
            })
            checkEqual(state[5], 2n, 'numberOfStakes with both positions in')

            const rewardOf = async (tokenId: bigint) =>
                read<readonly [bigint, bigint]>(ctx, {
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'getRewardInfo',
                    args: [keyTuple(key), tokenId],
                })
            const [before1, before2] = [
                await rewardOf(position.tokenId),
                await rewardOf(second.tokenId),
            ]
            await sleep(30, 'both positions accruing at once')
            const [after1, after2] = [
                await rewardOf(position.tokenId),
                await rewardOf(second.tokenId),
            ]
            const gained1 = after1[0] - before1[0]
            const gained2 = after2[0] - before2[0]
            info('account 1 liquidity', position.liquidity)
            info('account 2 liquidity', second.liquidity)
            info('account 1 gained', fmt(gained1, rewardToken.decimals))
            info('account 2 gained', fmt(gained2, rewardToken.decimals))
            check(gained1 > 0n && gained2 > 0n, 'both positions earned in the same window')
            // Both are in range for the whole window, so the split is the liquidity ratio.
            const expected2 = (gained1 * second.liquidity) / position.liquidity
            checkClose(gained2, expected2, 5, "account 2's share follows its liquidity")

            await call(secondCtx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'unstakeToken',
                args: [keyTuple(key), second.tokenId],
                label: 'unstakeToken (account 2)',
            })
            const banked = await read<bigint>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'rewards',
                args: [rewardToken.address, secondCtx.account],
            })
            check(banked > 0n, `account 2 banked ${fmt(banked, rewardToken.decimals)}`)
            await call(secondCtx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'claimReward',
                args: [rewardToken.address, secondCtx.account, 0n],
                label: 'claimReward (account 2)',
            })
            await call(secondCtx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'withdrawToken',
                args: [second.tokenId, secondCtx.account, '0x'],
                label: 'withdrawToken (account 2)',
            })
            const owner = await read<Address>(ctx, {
                address: config.nfpm,
                abi: NFPM_ABI,
                functionName: 'ownerOf',
                args: [second.tokenId],
            })
            checkEqual(owner, secondCtx.account, 'NFT back with account 2')
        },
        { fatal: false }
    )

    await step('The incentive cannot be ended while a position is staked', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'endIncentive',
                    args: [keyTuple(key)],
                    account: ctx.account,
                }),
            'ending an incentive with a live stake'
        )
    })

    await step('Unstake and bank the reward', async () => {
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'unstakeToken',
            args: [keyTuple(key), position.tokenId],
            label: 'unstakeToken',
        })
        const owed = await read<bigint>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'rewards',
            args: [rewardToken.address, ctx.account],
        })
        check(owed > 0n, `banked ${fmt(owed, rewardToken.decimals)} ${rewardToken.symbol}`)
        const state = await read<readonly bigint[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'incentives',
            args: [incentiveId],
        })
        checkEqual(state[5], 0n, 'numberOfStakes back to zero')
    })

    await step('claimReward pays a partial amount when one is requested', async () => {
        const owed = await read<bigint>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'rewards',
            args: [rewardToken.address, ctx.account],
        })
        const half = owed / 2n
        if (half === 0n) {
            check(true, 'reward too small to split — skipping the partial claim')
            return
        }
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'claimReward',
            args: [rewardToken.address, ctx.account, half],
            label: 'claimReward (partial)',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        checkEqual(after - before, half, 'partial claim paid exactly what was requested')
        const left = await read<bigint>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'rewards',
            args: [rewardToken.address, ctx.account],
        })
        checkEqual(left, owed - half, 'remainder still owed')
    })

    await step('claimReward with 0 pays out everything left', async () => {
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'claimReward',
            args: [rewardToken.address, ctx.account, 0n],
            label: 'claimReward (all)',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        check(after > before, `claimed ${fmt(after - before, rewardToken.decimals)}`)
        const left = await read<bigint>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'rewards',
            args: [rewardToken.address, ctx.account],
        })
        checkEqual(left, 0n, 'nothing owed after claiming everything')
    })

    await step('Re-stake so the end-of-incentive path can be tested', async () => {
        // Everything above runs inside the incentive window; on a short one there is nothing left
        // to re-stake into, and the finalize steps that follow have nothing to work with.
        if ((await now(ctx)) >= Number(key.endTime)) {
            check(true, 'incentive already ended — raise INCENTIVE_SECONDS to reach this path')
            return
        }
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'stakeToken',
            args: [keyTuple(key), position.tokenId],
            label: 'stakeToken again',
        })
        check(true, 'position staked for the rest of the incentive')
    })

    await step('finalizeStake records the final in-range reading after the end', async () => {
        await waitUntil(ctx, Number(endTime) + 2, 'incentive end')
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'finalizeStake',
            args: [keyTuple(key), position.tokenId],
            label: 'finalizeStake',
        })
        const stake = await read<readonly unknown[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'stakes',
            args: [position.tokenId, incentiveId],
        })
        checkEqual(stake[5], true, 'finalized')
        check((stake[4] as number) > 0, `secondsInsideFinal = ${stake[4]}`)
    })

    await step('finalizeStake cannot run twice', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'finalizeStake',
                    args: [keyTuple(key), position.tokenId],
                    account: ctx.account,
                }),
            'finalizing twice'
        )
    })

    await step('Staking after the end reverts', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: staker,
                    abi: JUNO_V3_STAKER_ABI,
                    functionName: 'stakeToken',
                    args: [keyTuple(key), position.tokenId],
                    account: ctx.account,
                }),
            'staking into an ended incentive'
        )
    })

    await step('Unstake after the incentive ended', async () => {
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'unstakeToken',
            args: [keyTuple(key), position.tokenId],
            label: 'unstakeToken after end',
        })
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'claimReward',
            args: [rewardToken.address, ctx.account, 0n],
            label: 'claimReward after end',
        })
        check(true, 'unstaked and claimed after the end')
    })

    await step(
        'transferDeposit hands the deposit to another address',
        async () => {
            if (!secondAccount) {
                check(true, 'SECOND_ADDRESS not set — skipped')
                return
            }
            await call(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'transferDeposit',
                args: [position.tokenId, secondAccount],
                label: 'transferDeposit',
            })
            const deposit = await read<readonly unknown[]>(ctx, {
                address: staker,
                abi: JUNO_V3_STAKER_ABI,
                functionName: 'deposits',
                args: [position.tokenId],
            })
            checkEqual(deposit[0], secondAccount, 'deposit owner moved')
            log('      NOTE: the NFT now belongs to SECOND_ADDRESS — withdraw it from that account')
        },
        { fatal: false }
    )

    await step('Withdraw the position NFT back to the owner', async () => {
        if (secondAccount && !secondCtx) {
            check(true, "deposit was transferred away — withdrawal is that account's to make")
            return
        }
        // After a transfer only the new owner can withdraw, so the second signer does it and sends
        // the NFT straight back — the run leaves the account exactly as it found it.
        const signer = secondAccount ? secondCtx! : ctx
        await call(signer, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'withdrawToken',
            args: [position.tokenId, ctx.account, '0x'],
            label: 'withdrawToken',
        })
        const owner = await read<Address>(ctx, {
            address: config.nfpm,
            abi: NFPM_ABI,
            functionName: 'ownerOf',
            args: [position.tokenId],
        })
        checkEqual(owner, ctx.account, 'NFT owner after withdrawal')
    })

    await step('endIncentive refunds whatever nobody earned', async () => {
        const state = await read<readonly bigint[]>(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'incentives',
            args: [incentiveId],
        })
        const unclaimed = state[1] ?? 0n
        info('totalRewardUnclaimed', fmt(unclaimed, rewardToken.decimals))
        if (unclaimed === 0n) {
            check(true, 'every token was earned — nothing to refund')
            return
        }
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: staker,
            abi: JUNO_V3_STAKER_ABI,
            functionName: 'endIncentive',
            args: [keyTuple(key)],
            label: 'endIncentive',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        checkEqual(after - before, unclaimed, 'refund paid to the refundee')
    })

    log(`\nIncentive: ${incentiveId}\nStaker: ${ctx.explorer}/address/${staker}`)
    summary()
}

main().catch((error) => {
    console.error(error)
    failRun(error)
    summary()
})
