/**
 * End-to-end exercise of the v2 token staker (StakingRewardsFactory + StakingRewards + Lens).
 *
 * Deploys a throwaway pool with a short epoch, then walks every feature the app exposes:
 * staking in lots, the per-lot lock, reward accrual, partial withdrawal by lot, claiming,
 * the factory's batch claim, the staking-power cap, a second epoch, closing and recovery.
 *
 * Read scripts/e2e/README.md first — this spends real testnet tokens.
 */
import {
    STAKING_REWARDS_ABI,
    STAKING_REWARDS_FACTORY_ABI,
    STAKING_REWARDS_LENS_ABI,
} from '../../lib/abis/staking-rewards'
import {
    balanceOf,
    call,
    check,
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
    parse,
    read,
    requireAddress,
    sleep,
    step,
    summary,
    tokenInfo,
    waitUntil,
    type Address,
} from './shared'

type PoolView = {
    stakingToken: Address
    rewardsToken: Address
    creator: Address
    totalSupply: bigint
    maxStakingPower: bigint
    remainingStakingPower: bigint
    rewardRate: bigint
    rewardPerTokenNow: bigint
    rewardForDuration: bigint
    unallocatedRewards: bigint
    rewardsBalance: bigint
    startTime: bigint
    periodFinish: bigint
    lastUpdateTime: bigint
    rewardsDuration: bigint
    lockDuration: bigint
    blockTimestamp: bigint
    closed: boolean
}

type UserView = {
    balance: bigint
    earned: bigint
    withdrawable: bigint
    nextUnlockAt: bigint
    lotCount: bigint
    liveLots: bigint
    stakingBalance: bigint
    stakingAllowance: bigint
}

type Lot = { amount: bigint; stakedAt: number; unlockAt: number }

async function main() {
    const ctx = makeCtx()
    const factory = requireAddress('STAKING_FACTORY')
    const lens = requireAddress('STAKING_LENS')
    const stakeTokenAddress = requireAddress('STAKE_TOKEN')
    const rewardTokenAddress = optionalAddress('REWARD_TOKEN') ?? stakeTokenAddress

    const epoch1Seconds = envNumber('EPOCH_SECONDS', 240)
    const epoch2Seconds = envNumber('EPOCH2_SECONDS', 60)
    const lockSeconds = envNumber('LOCK_SECONDS', 45)
    const stakeAmountA = process.env.STAKE_AMOUNT_A ?? '1'
    const stakeAmountB = process.env.STAKE_AMOUNT_B ?? '2'
    const rewardAmountText = process.env.REWARD_AMOUNT ?? '10'

    let pool = '0x' as Address
    let lotUnlockAt = 0

    const stakeToken = await step('Read the staking token', () =>
        tokenInfo(ctx, stakeTokenAddress)
    )!
    const rewardToken = await step('Read the reward token', () =>
        tokenInfo(ctx, rewardTokenAddress)
    )!
    if (!stakeToken || !rewardToken) return summary()

    const amountA = parse(stakeAmountA, stakeToken.decimals)
    const amountB = parse(stakeAmountB, stakeToken.decimals)
    const rewardAmount = parse(rewardAmountText, rewardToken.decimals)
    const cap = amountA + amountB

    await step('Preflight: balances cover the run', async () => {
        const stakeBalance = await balanceOf(ctx, stakeToken.address, ctx.account)
        const rewardBalance = await balanceOf(ctx, rewardToken.address, ctx.account)
        info('account', ctx.account)
        info(`${stakeToken.symbol} balance`, fmt(stakeBalance, stakeToken.decimals))
        info(`${rewardToken.symbol} balance`, fmt(rewardBalance, rewardToken.decimals))
        check(
            stakeBalance >= cap,
            `enough ${stakeToken.symbol} to stake ${fmt(cap, stakeToken.decimals)}`
        )
        check(
            rewardBalance >= rewardAmount * 2n,
            `enough ${rewardToken.symbol} for two epochs of ${rewardAmountText}`
        )
    })

    await step('Factory service fee is readable and paid if set', async () => {
        const feeToken = await read<Address>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'feeToken',
        })
        const feeAmount = await read<bigint>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'feeAmount',
        })
        info('feeToken', feeToken)
        info('feeAmount', feeAmount.toString())
        if (feeAmount > 0n && feeToken !== '0x0000000000000000000000000000000000000000') {
            await ensureAllowance(ctx, feeToken, factory, feeAmount * 4n, 'service fee')
        }
        check(true, 'fee configuration read')
    })

    await step('Deploy a pool with a lock and a staking-power cap', async () => {
        await ensureAllowance(ctx, rewardToken.address, factory, rewardAmount * 4n, 'reward budget')
        const result = await call(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'deploy',
            args: [
                stakeToken.address,
                rewardToken.address,
                rewardAmount,
                0n, // start immediately
                BigInt(epoch1Seconds),
                BigInt(lockSeconds),
                cap,
            ],
            label: 'deploy pool',
        })
        pool = result as Address
        info('pool', pool)
        check(/^0x[a-fA-F0-9]{40}$/.test(pool), 'factory returned a pool address')
    })

    await step('Factory records the pool for this creator', async () => {
        const count = await read<bigint>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'poolsByCreatorLength',
            args: [ctx.account],
        })
        check(count > 0n, `poolsByCreatorLength = ${count}`)
        const info0 = await read<readonly unknown[]>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'poolInfo',
            args: [pool],
        })
        checkEqual(info0[0], ctx.account, 'poolInfo.creator')
        checkEqual(info0[5], 1, 'poolInfo.epoch')
    })

    await step('Lens returns the pool with the parameters we deployed', async () => {
        const [, pools, , poolViews] = await read<
            [bigint, Address[], readonly unknown[], PoolView[], UserView[]]
        >(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'statesByFactory',
            args: [factory, ctx.account, 0n, 100n],
        })
        const index = pools.findIndex((p) => p.toLowerCase() === pool.toLowerCase())
        check(index >= 0, 'pool is listed by statesByFactory')
        const view = poolViews[index]
        if (!view) throw new Error('no pool view at that index')
        checkEqual(view.stakingToken, stakeToken.address, 'stakingToken')
        checkEqual(view.rewardsToken, rewardToken.address, 'rewardsToken')
        checkEqual(view.lockDuration, BigInt(lockSeconds), 'lockDuration')
        checkEqual(view.maxStakingPower, cap, 'maxStakingPower')
        checkEqual(view.rewardForDuration, rewardAmount, 'rewardForDuration')
        check(view.rewardRate > 0n, `rewardRate = ${view.rewardRate}`)
    })

    await step('Stake the first lot', async () => {
        await ensureAllowance(ctx, stakeToken.address, pool, cap * 4n, 'staking token')
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'stake',
            args: [amountA],
            label: 'stake A',
        })
        const balance = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'balanceOf',
            args: [ctx.account],
        })
        checkEqual(balance, amountA, 'balanceOf after the first stake')
    })

    await step('Stake a second lot with its own unlock time', async () => {
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'stake',
            args: [amountB],
            label: 'stake B',
        })
        const lots = await read<Lot[]>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getUserInfos',
            args: [ctx.account],
        })
        checkEqual(lots.length, 2, 'lot count')
        const first = lots[0]
        const second = lots[1]
        if (!first || !second) throw new Error('missing lots')
        check(
            second.unlockAt >= first.unlockAt,
            `later lot unlocks no earlier (${first.unlockAt} → ${second.unlockAt})`
        )
        lotUnlockAt = Math.max(first.unlockAt, second.unlockAt)
        info('unlock at', lotUnlockAt)
    })

    await step('The cap rejects a stake beyond the staking power', async () => {
        const remaining = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'remainingStakingPower',
        })
        checkEqual(remaining, 0n, 'remainingStakingPower once the cap is full')
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: pool,
                    abi: STAKING_REWARDS_ABI,
                    functionName: 'stake',
                    args: [1n],
                    account: ctx.account,
                }),
            'staking past the cap'
        )
    })

    await step('Rewards accrue while staked', async () => {
        const before = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'earned',
            args: [ctx.account],
        })
        await sleep(20, 'let rewards accrue')
        const after = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'earned',
            args: [ctx.account],
        })
        info('earned before', fmt(before, rewardToken.decimals))
        info('earned after', fmt(after, rewardToken.decimals))
        check(after > before, 'earned grew over 20 seconds')
    })

    await step('Withdrawing a locked stake reverts', async () => {
        const withdrawable = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'withdrawableOf',
            args: [ctx.account],
        })
        checkEqual(withdrawable, 0n, 'withdrawable while locked')
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: pool,
                    abi: STAKING_REWARDS_ABI,
                    functionName: 'withdraw',
                    args: [amountA],
                    account: ctx.account,
                }),
            'withdrawing before the unlock'
        )
    })

    await step('Claiming is never blocked by the lock', async () => {
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getReward',
            label: 'getReward while locked',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        check(after > before, `reward balance rose by ${fmt(after - before, rewardToken.decimals)}`)
    })

    await step('The lock expires on schedule', async () => {
        await waitUntil(ctx, lotUnlockAt + 2, 'lock')
        const withdrawable = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'withdrawableOf',
            args: [ctx.account],
        })
        checkEqual(withdrawable, cap, 'withdrawable once both lots unlocked')
    })

    await step('Withdraw one specific lot with withdrawFrom', async () => {
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'withdrawFrom',
            args: [0n, amountA],
            label: 'withdrawFrom lot 0',
        })
        const balance = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'balanceOf',
            args: [ctx.account],
        })
        checkEqual(balance, amountB, 'balance after withdrawing lot 0')
    })

    await step("The factory's batch claim works across pools", async () => {
        await sleep(15, 'accrue something to batch-claim')
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'claimAll',
            args: [[pool]],
            label: 'claimAll',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        check(after > before, `claimAll paid ${fmt(after - before, rewardToken.decimals)}`)
    })

    await step('exit() withdraws the rest and claims in one call', async () => {
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'exit',
            label: 'exit',
        })
        const balance = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'balanceOf',
            args: [ctx.account],
        })
        checkEqual(balance, 0n, 'balance after exit')
    })

    await step('A second epoch cannot start while the first is running', async () => {
        const view = await read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
        const current = await now(ctx)
        if (Number(view.periodFinish) <= current) {
            log('      epoch already finished, nothing to assert here')
            check(true, 'epoch already over')
            return
        }
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: factory,
                    abi: STAKING_REWARDS_FACTORY_ABI,
                    functionName: 'startEpoch',
                    args: [pool, rewardAmount, 0n, BigInt(epoch2Seconds), 0n, 0n],
                    account: ctx.account,
                }),
            'starting an epoch mid-epoch'
        )
    })

    await step('Fund a second epoch once the first ends', async () => {
        const view = await read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
        await waitUntil(ctx, Number(view.periodFinish) + 2, 'epoch 1 finish')
        await ensureAllowance(
            ctx,
            rewardToken.address,
            factory,
            rewardAmount * 2n,
            'epoch 2 budget'
        )
        await call(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'startEpoch',
            args: [pool, rewardAmount, 0n, BigInt(epoch2Seconds), 0n, 0n],
            label: 'startEpoch 2',
        })
        const poolInfo = await read<readonly unknown[]>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'poolInfo',
            args: [pool],
        })
        checkEqual(poolInfo[5], 2, 'poolInfo.epoch after funding')
        const next = await read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
        checkEqual(next.lockDuration, 0n, 'epoch 2 has no lock')
        check(next.periodFinish > view.periodFinish, 'periodFinish moved forward')
    })

    await step('Staking works in the new epoch and unlocks immediately', async () => {
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'stake',
            args: [amountA],
            label: 'stake in epoch 2',
        })
        const withdrawable = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'withdrawableOf',
            args: [ctx.account],
        })
        checkEqual(withdrawable, amountA, 'withdrawable with no lock')
        await sleep(15, 'accrue in epoch 2')
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'exit',
            label: 'exit epoch 2',
        })
        check(true, 'staked, accrued and exited inside epoch 2')
    })

    await step('Close the pool for good', async () => {
        const view = await read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
        await waitUntil(ctx, Number(view.periodFinish) + 2, 'epoch 2 finish')
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'close',
            label: 'close',
        })
        const closed = await read<boolean>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'closed',
        })
        checkEqual(closed, true, 'closed')
    })

    await step('A closed pool refuses new stakes and new epochs', async () => {
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: pool,
                    abi: STAKING_REWARDS_ABI,
                    functionName: 'stake',
                    args: [amountA],
                    account: ctx.account,
                }),
            'staking into a closed pool'
        )
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: factory,
                    abi: STAKING_REWARDS_FACTORY_ABI,
                    functionName: 'startEpoch',
                    args: [pool, rewardAmount, 0n, BigInt(epoch2Seconds), 0n, 0n],
                    account: ctx.account,
                }),
            'funding a closed pool'
        )
    })

    await step('Recover the budget that ran with nothing staked', async () => {
        const unallocated = await read<bigint>(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'unallocatedRewards',
        })
        info('unallocated', fmt(unallocated, rewardToken.decimals))
        if (unallocated === 0n) {
            check(true, 'nothing went unallocated — every second had a staker')
            return
        }
        const before = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'recoverUnallocatedRewards',
            label: 'recoverUnallocatedRewards',
        })
        const after = await balanceOf(ctx, rewardToken.address, ctx.account)
        check(after > before, `recovered ${fmt(after - before, rewardToken.decimals)}`)
    })

    log(`\nPool under test: ${ctx.explorer}/address/${pool}`)
    summary()
}

main().catch((error) => {
    console.error(error)
    failRun(error)
    summary()
})
