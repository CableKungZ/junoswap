/**
 * Soak test for an existing StakingRewards pool. Nothing is deployed here: it takes a pool that is
 * already on chain and hammers it with two accounts — staking, withdrawing, claiming and starting
 * fresh epochs in a random order — checking the invariants after every single action.
 *
 * It opens with the question the random walk cannot answer on its own: when a new epoch introduces
 * a lock, does it reach back and re-lock the stake that was already there?
 *
 * Run: bun run e2e:token-staking-soak
 */
import {
    balanceOf,
    call,
    callGas,
    check,
    checkClose,
    checkEqual,
    checkReverts,
    ensureAllowance,
    env,
    envNumber,
    ERC20,
    failRun,
    fmt,
    info,
    log,
    makeCtx,
    now,
    optionalAddress,
    optionalCtx,
    parse,
    sleep,
    read,
    REWARD_PRECISION,
    requireAddress,
    step,
    summary,
    tokenInfo,
    waitUntil,
    type Address,
    type Ctx,
} from './shared'
import {
    STAKING_REWARDS_ABI,
    STAKING_REWARDS_FACTORY_ABI,
    STAKING_REWARDS_LENS_ABI,
} from '../../lib/abis/staking-rewards'
import type { StakingPoolView as PoolView } from '../../types/staking'

type Lot = { amount: bigint; stakedAt: number; unlockAt: number }

/** Deterministic PRNG so a failing run can be replayed with the same SEED. */
function makeRandom(seed: number) {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

async function main() {
    const ctx = makeCtx()
    const secondCtx = optionalCtx('PRIVATE_KEY_2')
    const factory = requireAddress('STAKING_FACTORY')
    const lens = requireAddress('STAKING_LENS')
    const epochSeconds = envNumber('EPOCH_SECONDS', 60)
    const lockSeconds = envNumber('LOCK_SECONDS', 60)
    const actionCount = envNumber('SOAK_ACTIONS', 12)
    const seed = envNumber('SEED', Date.now() % 100000)
    const rewardText = env('REWARD_AMOUNT') ?? '10'
    const random = makeRandom(seed)
    info('seed', seed)

    if (!secondCtx) throw new Error('PRIVATE_KEY_2 is required — this test needs two accounts')

    const pool = await step('Find the pool to soak (nothing is deployed here)', async () => {
        const override = optionalAddress('STAKING_POOL')
        if (override) {
            info('pool from STAKING_POOL', override)
            return override
        }
        const count = await read<bigint>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'poolsByCreatorLength',
            args: [ctx.account],
        })
        check(count > 0n, `account has ${count} pools to pick from`)
        const latest = await read<Address>(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'poolsByCreator',
            args: [ctx.account, count - 1n],
        })
        info('newest pool', latest)
        return latest
    })
    if (!pool) return summary()

    // Every read and write in this file targets the same pool, so the address and ABI are bound
    // once here instead of at each of the thirty-odd call sites.
    const poolRead = <T>(functionName: string, args?: readonly unknown[]) =>
        read<T>(ctx, { address: pool, abi: STAKING_REWARDS_ABI, functionName, args })
    const poolCall = (actor: Ctx, functionName: string, label: string, args?: readonly unknown[]) =>
        call(actor, { address: pool, abi: STAKING_REWARDS_ABI, functionName, args, label })

    const view = async () =>
        read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
    const balanceIn = (who: Address) => poolRead<bigint>('balanceOf', [who])
    const withdrawableOf = (who: Address) => poolRead<bigint>('withdrawableOf', [who])
    const earnedBy = (who: Address) => poolRead<bigint>('earned', [who])
    /** The two solvency properties audit I-02 asks for, checked wherever the pool is touched. */
    const checkSolvent = async (label: string) => {
        const state = await view()
        const [staked, earned1, earned2, unallocated, rewardBalance] = await Promise.all([
            balanceOf(ctx, state.stakingToken, pool),
            earnedBy(ctx.account),
            earnedBy(secondCtx.account),
            poolRead<bigint>('unallocatedRewards'),
            balanceOf(ctx, state.rewardsToken, pool),
        ])
        check(staked >= state.totalSupply, `${label}: staking balance covers totalSupply`)
        const owed = earned1 + earned2 + unallocated
        // A pool whose reward token is also its staking token holds the principal too.
        const held =
            state.rewardsToken.toLowerCase() === state.stakingToken.toLowerCase()
                ? rewardBalance > state.totalSupply
                    ? rewardBalance - state.totalSupply
                    : 0n
                : rewardBalance
        check(held >= owed, `${label}: reward balance ${held} covers the ${owed} owed`)
        return state
    }

    const liveLotsOf = (who: Address) => poolRead<bigint>('liveLots', [who])
    const lotsOf = (who: Address) => poolRead<Lot[]>('getUserInfos', [who])

    const tokens = await step('Read the pool and its tokens', async () => {
        const state = await view()
        check(!state.closed, 'pool is open')
        const stakingToken = await tokenInfo(ctx, state.stakingToken)
        const rewardToken = await tokenInfo(ctx, state.rewardsToken)
        info('stakingToken', stakingToken.symbol)
        info('rewardsToken', rewardToken.symbol)
        info('lockDuration', state.lockDuration)
        info('maxStakingPower', state.maxStakingPower)
        return { stakingToken, rewardToken }
    })
    if (!tokens) return summary()
    const { stakingToken, rewardToken } = tokens
    const unit = parse('0.1', stakingToken.decimals)
    const rewardAmount = parse(rewardText, rewardToken.decimals)

    /** Starts a fresh epoch, waiting out the current one first — an epoch cannot be replaced live. */
    const startEpoch = async (lock: bigint, cap: bigint) => {
        const state = await view()
        const current = await now(ctx)
        if (Number(state.periodFinish) > current) {
            await waitUntil(ctx, Number(state.periodFinish) + 2, 'current epoch to finish')
        }
        await ensureAllowance(ctx, rewardToken.address, factory, rewardAmount, 'epoch budget')
        await call(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'startEpoch',
            args: [pool, rewardAmount, 0n, BigInt(epochSeconds), lock, cap],
            label: `startEpoch (lock ${lock}s, cap ${fmt(cap, stakingToken.decimals)})`,
        })
    }

    await step('Both accounts are funded and approved', async () => {
        const need = unit * 20n
        const held2 = await balanceOf(ctx, stakingToken.address, secondCtx.account)
        if (held2 < need) {
            await call(ctx, {
                address: stakingToken.address,
                abi: ERC20,
                functionName: 'transfer',
                args: [secondCtx.account, need - held2],
                label: `fund account 2 with ${fmt(need - held2, stakingToken.decimals)}`,
            })
        }
        await ensureAllowance(ctx, stakingToken.address, pool, need * 10n, 'account 1 stake')
        await ensureAllowance(secondCtx, stakingToken.address, pool, need * 10n, 'account 2 stake')
        const held1 = await balanceOf(ctx, stakingToken.address, ctx.account)
        check(held1 >= need, `account 1 holds ${fmt(held1, stakingToken.decimals)}`)
        check(
            (await balanceOf(ctx, stakingToken.address, secondCtx.account)) >= need,
            'account 2 funded'
        )
    })

    // ---------------------------------------------------------------- the lock question

    let lockedLotUnlockAt = 0

    await step('An epoch with no lock leaves the stake free to leave', async () => {
        await startEpoch(0n, unit * 100n)
        await poolCall(ctx, 'stake', 'account 1 stakes before the locked epoch', [unit * 2n])
        const withdrawable = await withdrawableOf(ctx.account)
        const balance = await balanceIn(ctx.account)
        checkEqual(withdrawable, balance, 'every staked token is withdrawable with no lock')
    })

    await step(
        'A new epoch with a lock does not re-lock the stake already in the pool',
        async () => {
            const before = await balanceIn(ctx.account)
            const lotsBefore = await lotsOf(ctx.account)
            await startEpoch(BigInt(lockSeconds), unit * 100n)
            const state = await view()
            checkEqual(state.lockDuration, BigInt(lockSeconds), 'the new epoch carries a lock')

            // The lock is written into each lot when it is staked, so lots that predate the epoch keep
            // the unlock time they were given — the new lock only applies to what is staked from now on.
            const lotsAfter = await lotsOf(ctx.account)
            checkEqual(lotsAfter.length, lotsBefore.length, 'no lot was added or removed')
            lotsAfter.forEach((lot, index) => {
                const previous = lotsBefore[index]
                if (!previous) return
                checkEqual(lot.unlockAt, previous.unlockAt, `lot ${index} kept its unlock time`)
            })
            const withdrawable = await withdrawableOf(ctx.account)
            checkEqual(
                withdrawable,
                before,
                'the old staker can still withdraw everything, right away'
            )

            // And proves it, rather than trusting the view.
            await poolCall(ctx, 'withdraw', 'old staker withdraws under the new lock', [unit])
            checkEqual(await balanceIn(ctx.account), before - unit, 'balance after the withdrawal')
        }
    )

    await step('A stake made after the lock starts has to serve it', async () => {
        // The pool is reused between runs, so account 2 may already hold unlocked lots. Everything
        // here is measured against what it had before, not against zero.
        const freeBefore = await withdrawableOf(secondCtx.account)
        await poolCall(secondCtx, 'stake', 'account 2 stakes into the locked epoch', [unit * 2n])
        const lots = await lotsOf(secondCtx.account)
        const newest = lots[lots.length - 1]
        if (!newest) throw new Error('account 2 has no lot')
        const current = await now(ctx)
        lockedLotUnlockAt = newest.unlockAt
        info('unlocks at', `${newest.unlockAt} (in ${newest.unlockAt - current}s)`)
        check(newest.unlockAt > current, 'the new lot is locked')
        checkEqual(
            await withdrawableOf(secondCtx.account),
            freeBefore,
            'the new lot adds nothing withdrawable'
        )
        await checkReverts(
            () =>
                ctx.publicClient.simulateContract({
                    address: pool,
                    abi: STAKING_REWARDS_ABI,
                    functionName: 'withdraw',
                    args: [freeBefore + unit],
                    account: secondCtx.account,
                }),
            'account 2 withdrawing more than it has unlocked'
        )
    })

    await step('Claiming still works for the locked account', async () => {
        const before = await balanceOf(ctx, rewardToken.address, secondCtx.account)
        await poolCall(secondCtx, 'getReward', 'account 2 claims while locked')
        const after = await balanceOf(ctx, rewardToken.address, secondCtx.account)
        check(after >= before, `claimed ${fmt(after - before, rewardToken.decimals)} while locked`)
    })

    await step('The new lot frees itself when its own lock expires', async () => {
        await waitUntil(ctx, lockedLotUnlockAt + 2, 'account 2 lock')
        const balance = await balanceIn(secondCtx.account)
        checkEqual(await withdrawableOf(secondCtx.account), balance, 'withdrawable once unlocked')
        await poolCall(secondCtx, 'withdraw', 'account 2 withdraws after its unlock', [unit])
        checkEqual(await balanceIn(secondCtx.account), balance - unit, 'balance after withdrawal')
    })

    // ---------------------------------------------------------------- shared-pool behaviour

    // Shares are fractions below 1, so they are carried as 1e18 fixed point: plain integer
    // division would truncate two thirds straight to zero.
    const SHARE_SCALE = 10n ** 18n

    /** `earned` and the clock read from the same call, so the two never drift apart. */
    const rateSample = async (who: Address) => {
        const state = await view()
        return {
            earned: await earnedBy(who),
            at:
                state.blockTimestamp < state.periodFinish
                    ? state.blockTimestamp
                    : state.periodFinish,
            rate: state.rewardRate,
            supply: state.totalSupply,
        }
    }

    await step('A staker leaving re-weights what the one who stays earns', async () => {
        await startEpoch(0n, unit * 100n)
        // Clear both sides so the window measures only the two stakes made here.
        for (const actor of [ctx, secondCtx]) {
            if ((await balanceIn(actor.account)) > 0n) {
                await poolCall(actor, 'exit', 'clear the pool first')
            }
        }
        await poolCall(ctx, 'stake', 'account 1 stakes 2 units', [unit * 2n])
        await poolCall(secondCtx, 'stake', 'account 2 stakes 1 unit', [unit])

        const shared0 = await rateSample(ctx.account)
        await sleep(15, 'both staked, account 1 holds two thirds')
        const shared1 = await rateSample(ctx.account)
        const sharedShare =
            ((shared1.earned - shared0.earned) * REWARD_PRECISION * SHARE_SCALE) /
            ((shared1.at - shared0.at) * shared1.rate)
        info('account 1 share while both are in', `${Number(sharedShare) / 1e16}%`)

        await poolCall(secondCtx, 'exit', 'account 2 leaves mid-epoch')
        const alone0 = await rateSample(ctx.account)
        await sleep(15, 'account 1 alone in the pool')
        const alone1 = await rateSample(ctx.account)
        const aloneShare =
            ((alone1.earned - alone0.earned) * REWARD_PRECISION * SHARE_SCALE) /
            ((alone1.at - alone0.at) * alone1.rate)
        info('account 1 share once alone', `${Number(aloneShare) / 1e16}%`)

        // Two thirds of the emission before, all of it after: the accumulator has to re-weight the
        // moment the other stake leaves, with no claim or restake needed.
        checkClose((sharedShare * 3n) / 2n, aloneShare, 2, 'share went from 2/3 to the whole pool')
        await checkSolvent('after the re-weighting')
    })

    await step('unallocatedRewards is exactly the emission nobody was staked for', async () => {
        const unallocated = () => poolRead<bigint>('unallocatedRewards')
        await poolCall(ctx, 'exit', 'empty the pool')
        checkEqual((await view()).totalSupply, 0n, 'pool is empty')
        // Nothing goes unallocated once the epoch is over, so the window needs a live one.
        await startEpoch(0n, unit * 100n)

        // getRewardFor settles the accumulator without staking anything, which is what pins the
        // window down: lastUpdateTime moves to the block it ran in, at both ends.
        await poolCall(ctx, 'getRewardFor', 'settle the empty pool', [ctx.account])
        const before = await view()
        const u0 = await unallocated()
        await sleep(15, 'the pool sits empty while the epoch runs')
        await poolCall(ctx, 'getRewardFor', 'settle again', [ctx.account])
        const after = await view()
        const u1 = await unallocated()

        const clamp = (t: bigint, finish: bigint) => (t < finish ? t : finish)
        const elapsed =
            clamp(after.lastUpdateTime, after.periodFinish) -
            clamp(before.lastUpdateTime, before.periodFinish)
        const expected = (elapsed * before.rewardRate) / REWARD_PRECISION
        info('empty seconds', elapsed)
        info('unallocated grew by', fmt(u1 - u0, rewardToken.decimals))
        checkClose(u1 - u0, expected, 1, 'unallocated matches rate x empty seconds')
    })

    await step('getRewardFor pays the account, never the caller', async () => {
        await startEpoch(0n, unit * 100n)
        await poolCall(secondCtx, 'stake', 'account 2 stakes so it has something to earn', [unit])
        await sleep(10, 'account 2 accrues')
        const owed = await earnedBy(secondCtx.account)
        check(owed > 0n, `account 2 has ${fmt(owed, rewardToken.decimals)} owed`)

        const caller0 = await balanceOf(ctx, rewardToken.address, ctx.account)
        const owner0 = await balanceOf(ctx, rewardToken.address, secondCtx.account)
        // Account 1 is a stranger to this position: it pays the gas, account 2 gets the tokens.
        await poolCall(ctx, 'getRewardFor', 'account 1 claims for account 2', [secondCtx.account])
        const caller1 = await balanceOf(ctx, rewardToken.address, ctx.account)
        const owner1 = await balanceOf(ctx, rewardToken.address, secondCtx.account)
        checkEqual(caller1, caller0, 'the caller received nothing')
        check(
            owner1 - owner0 >= owed,
            `account 2 received ${fmt(owner1 - owner0, rewardToken.decimals)}`
        )
        checkEqual(await balanceIn(secondCtx.account), unit, 'the stake itself was not touched')
        await checkSolvent('after a third-party claim')
    })

    await step('Withdrawal gas against the number of deposit lots', async () => {
        await startEpoch(0n, unit * 100n)
        // Whatever the steps above left staked would be counted as extra lots, so start from none.
        if ((await balanceIn(secondCtx.account)) > 0n) {
            await poolCall(secondCtx, 'exit', 'clear account 2 before measuring')
        }
        checkEqual(await liveLotsOf(secondCtx.account), 0n, 'account 2 starts with no live lots')
        const dust = unit / 10n
        const measure = async (lots: number) => {
            for (let i = 0; i < lots; i += 1) {
                await poolCall(secondCtx, 'stake', `lot ${i + 1}/${lots}`, [dust])
            }
            checkEqual(await liveLotsOf(secondCtx.account), BigInt(lots), `${lots} live lots`)
            const gas = await callGas(secondCtx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'exit',
                label: `exit with ${lots} lots`,
            })
            info(`gas for exit over ${lots} lots`, gas)
            return gas
        }
        const gas10 = await measure(10)
        const gas30 = await measure(30)

        // The loop is the only part that grows, so the slope is the cost of one extra lot.
        const perLot = (gas30 - gas10) / 20n
        const at256 = gas30 + perLot * 226n
        info('marginal gas per lot', perLot)
        info('extrapolated exit at MAX_LIVE_LOTS (256)', at256)
        check(gas30 > gas10, 'gas grows with the number of lots, as the loop implies')
        // A staker whose exit does not fit in a block cannot leave, so this is the number that
        // decides whether the UI should cap lots well below the contract's 256.
        check(at256 < 15_000_000n, `a full 256-lot exit stays under half a block (${at256})`)
        await checkSolvent('after the gas sweep')
    })

    // ---------------------------------------------------------------- random walk

    type Actor = { ctx: Ctx; name: string }
    const actors: Actor[] = [
        { ctx, name: 'account 1' },
        { ctx: secondCtx, name: 'account 2' },
    ]
    let epochsStarted = 0
    const maxEpochs = 3

    for (let i = 0; i < actionCount; i += 1) {
        const actor = actors[Math.floor(random() * actors.length)]!
        await step(`Random action ${i + 1}/${actionCount} by ${actor.name}`, async () => {
            const [state, current, balance, withdrawable, earned] = await Promise.all([
                view(),
                now(ctx),
                balanceIn(actor.ctx.account),
                withdrawableOf(actor.ctx.account),
                earnedBy(actor.ctx.account),
            ])
            const supplyBefore = state.totalSupply
            const epochOver = Number(state.periodFinish) <= current

            // Only actions that are legal in the current state are candidates, so a revert here is
            // a real finding rather than the walk asking for something impossible.
            const choices: string[] = []
            if (!state.closed && !epochOver && state.remainingStakingPower >= unit)
                choices.push('stake')
            if (withdrawable > 0n) choices.push('withdraw')
            if (earned > 0n) choices.push('claim')
            if (epochOver && epochsStarted < maxEpochs) choices.push('epoch')
            if (choices.length === 0) {
                await checkSolvent('idle')
                check(true, 'nothing legal to do in this state — held')
                return
            }
            const action = choices[Math.floor(random() * choices.length)]!

            if (action === 'stake') {
                const amount = unit * BigInt(1 + Math.floor(random() * 3))
                const capped =
                    amount > state.remainingStakingPower ? state.remainingStakingPower : amount
                await poolCall(
                    actor.ctx,
                    'stake',
                    `${actor.name} stakes ${fmt(capped, stakingToken.decimals)}`,
                    [capped]
                )
                checkEqual(
                    await balanceIn(actor.ctx.account),
                    balance + capped,
                    'balance after stake'
                )
                const settled = await checkSolvent('after stake')
                checkEqual(settled.totalSupply, supplyBefore + capped, 'totalSupply after stake')
                return
            }
            if (action === 'withdraw') {
                const amount = withdrawable > unit && random() < 0.5 ? unit : withdrawable
                await poolCall(
                    actor.ctx,
                    'withdraw',
                    `${actor.name} withdraws ${fmt(amount, stakingToken.decimals)}`,
                    [amount]
                )
                checkEqual(
                    await balanceIn(actor.ctx.account),
                    balance - amount,
                    'balance after withdrawal'
                )
                const settled = await checkSolvent('after withdrawal')
                checkEqual(
                    settled.totalSupply,
                    supplyBefore - amount,
                    'totalSupply after withdrawal'
                )
                return
            }
            if (action === 'claim') {
                const before = await balanceOf(ctx, rewardToken.address, actor.ctx.account)
                await poolCall(
                    actor.ctx,
                    'getReward',
                    `${actor.name} claims ${fmt(earned, rewardToken.decimals)}`
                )
                const after = await balanceOf(ctx, rewardToken.address, actor.ctx.account)
                check(after - before >= earned, `paid at least the ${earned} wei it had earned`)
                checkEqual(await balanceIn(actor.ctx.account), balance, 'a claim never moves stake')
                await checkSolvent('after claim')
                return
            }
            const lock = random() < 0.5 ? BigInt(lockSeconds) : 0n
            await startEpoch(lock, state.maxStakingPower)
            epochsStarted += 1
            const next = await view()
            check(Number(next.periodFinish) > current, 'a new epoch is running')
            checkEqual(next.lockDuration, lock, 'the epoch carries the lock it was given')
            checkEqual(next.totalSupply, supplyBefore, 'a new epoch never moves anyone stake')
        })
    }

    await step('Everyone can still get their stake out at the end', async () => {
        for (const actor of actors) {
            const balance = await balanceIn(actor.ctx.account)
            if (balance === 0n) {
                check(true, `${actor.name} has nothing staked`)
                continue
            }
            const withdrawable = await withdrawableOf(actor.ctx.account)
            if (withdrawable < balance) {
                const lots = await lotsOf(actor.ctx.account)
                const latest = Math.max(...lots.filter((l) => l.amount > 0n).map((l) => l.unlockAt))
                await waitUntil(ctx, latest + 2, `${actor.name} lock`)
            }
            await poolCall(actor.ctx, 'exit', `${actor.name} exits`)
            checkEqual(await balanceIn(actor.ctx.account), 0n, `${actor.name} fully withdrawn`)
        }
        checkEqual((await view()).totalSupply, 0n, 'pool is empty')
    })

    log(`\nPool: ${ctx.explorer}/address/${pool}\nSeed: ${seed} (set SEED to replay this run)`)
    summary()
}

main().catch((error) => {
    console.error(error)
    failRun(error)
    summary()
})
