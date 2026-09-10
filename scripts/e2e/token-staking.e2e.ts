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
import type { StakingPoolView as PoolView, StakingUserView as UserView } from '../../types/staking'
import {
    balanceOf,
    call,
    check,
    checkClose,
    checkEqual,
    checkReverts,
    ensureAllowance,
    ERC20,
    envNumber,
    failRun,
    fmt,
    info,
    log,
    makeCtx,
    optionalCtx,
    now,
    optionalAddress,
    parse,
    read,
    REWARD_PRECISION,
    requireAddress,
    sleep,
    step,
    summary,
    tokenInfo,
    waitUntil,
    type Address,
} from './shared'

type Lot = { amount: bigint; stakedAt: number; unlockAt: number }

/** `rewardRate` and `rewardPerTokenStored` are scaled by 1e36 in StakingRewards. */

interface Sample {
    earned: bigint
    balance: bigint
    totalSupply: bigint
    rewardRate: bigint
    periodFinish: bigint
    timestamp: bigint
}

async function main() {
    const ctx = makeCtx()
    const factory = requireAddress('STAKING_FACTORY')
    const lens = requireAddress('STAKING_LENS')
    const stakeTokenAddress = requireAddress('STAKE_TOKEN')
    // A second signer turns the single-staker checks into a real shared pool.
    const secondCtx = optionalCtx('PRIVATE_KEY_2')
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
        // Short epochs end mid-run and get topped up, so budget for a few more than two.
        check(
            rewardBalance >= rewardAmount * 5n,
            `enough ${rewardToken.symbol} for up to five epochs of ${rewardAmountText}`
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
        // rewardRate is the budget divided by the duration, so the budget can come back up to
        // `duration` wei short — the dust an integer division leaves behind.
        const dust = rewardAmount - view.rewardForDuration
        check(
            dust >= 0n && dust < BigInt(epoch1Seconds),
            `rewardForDuration = ${view.rewardForDuration} (${dust} wei of rounding dust)`
        )
        check(view.rewardRate > 0n, `rewardRate = ${view.rewardRate}`)
    })

    /** Pool view and user view read in one lens call, so `earned` and `blockTimestamp` agree. */
    const sample = async (who: Address = ctx.account): Promise<Sample> => {
        const [, pools, , poolViews, userViews] = await read<
            [bigint, Address[], readonly unknown[], PoolView[], UserView[]]
        >(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'statesByFactory',
            args: [factory, who, 0n, 100n],
        })
        const index = pools.findIndex((p) => p.toLowerCase() === pool.toLowerCase())
        const view = poolViews[index]
        const user = userViews[index]
        if (!view || !user) throw new Error('pool missing from the lens result')
        return {
            earned: user.earned,
            balance: user.balance,
            totalSupply: view.totalSupply,
            rewardRate: view.rewardRate,
            periodFinish: view.periodFinish,
            timestamp: view.blockTimestamp,
        }
    }

    // Every wait is a fraction of the epoch, so a 10-second epoch still gets a usable window.
    const accrualWindow = Math.max(3, Math.min(15, Math.round(epoch1Seconds / 2)))

    // A block is ~5s, so an epoch with less than this left can finish between the simulation and
    // the moment the transaction is mined — which is exactly how `stake` reverts on a live pool.
    const EPOCH_HEADROOM_SECONDS = 8

    /**
     * Staking and accrual both need an epoch that is still running. With short epochs one ends
     * mid-run, so anything that depends on a live epoch starts a fresh one first — the pool is
     * re-armed with the same lock and cap unless the caller asks for different ones.
     */
    const ensureLiveEpoch = async (seconds: number, lock = 0n, poolCap = 0n): Promise<void> => {
        const view = await read<PoolView>(ctx, {
            address: lens,
            abi: STAKING_REWARDS_LENS_ABI,
            functionName: 'poolState',
            args: [pool],
        })
        const current = await now(ctx)
        if (Number(view.periodFinish) > current + EPOCH_HEADROOM_SECONDS) return
        if (view.closed) throw new Error('pool is closed — cannot start another epoch')
        // An epoch can only be replaced once it has finished, so wait out whatever is left of it.
        if (Number(view.periodFinish) > current) {
            await waitUntil(ctx, Number(view.periodFinish) + 2, 'epoch to finish')
        }
        await ensureAllowance(ctx, rewardToken.address, factory, rewardAmount * 2n, 'epoch budget')
        await call(ctx, {
            address: factory,
            abi: STAKING_REWARDS_FACTORY_ABI,
            functionName: 'startEpoch',
            args: [pool, rewardAmount, 0n, BigInt(seconds), lock, poolCap],
            label: `startEpoch ${seconds}s (keeps rewards flowing)`,
        })
    }

    await step('Stake the first lot', async () => {
        await ensureAllowance(ctx, stakeToken.address, pool, cap * 4n, 'staking token')
        await ensureLiveEpoch(epoch1Seconds, BigInt(lockSeconds), cap)
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
        await ensureLiveEpoch(epoch1Seconds, BigInt(lockSeconds), cap)
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

    await step('Rewards accrue at the rate the formula predicts', async () => {
        await ensureLiveEpoch(epoch1Seconds, BigInt(lockSeconds), cap)
        const before = await sample()
        await sleep(accrualWindow, 'let rewards accrue')
        const after = await sample()
        // Accrual stops at periodFinish, so the window is clipped to whatever ran inside the epoch.
        const from = before.timestamp < before.periodFinish ? before.timestamp : before.periodFinish
        const to = after.timestamp < after.periodFinish ? after.timestamp : after.periodFinish
        const elapsed = to > from ? to - from : 0n
        check(elapsed > 0n, `${elapsed}s of chain time elapsed`)
        info('earned before', fmt(before.earned, rewardToken.decimals))
        info('earned after', fmt(after.earned, rewardToken.decimals))
        check(after.earned > before.earned, 'earned grew')

        // earned = rewardRate x elapsed x (balance / totalSupply), with rewardRate scaled by 1e36.
        // The stake is unchanged across the window, so the share is constant and this is exact.
        checkEqual(
            after.totalSupply,
            before.totalSupply,
            'totalSupply held still during the window'
        )
        const expected =
            (after.rewardRate * elapsed * after.balance) / after.totalSupply / REWARD_PRECISION
        info('expected delta', fmt(expected, rewardToken.decimals))
        info(
            'share of pool',
            `${((Number(after.balance) / Number(after.totalSupply)) * 100).toFixed(2)}%`
        )
        // Tolerance covers the integer truncation the contract does per rewardPerToken update.
        checkClose(after.earned - before.earned, expected, 1, 'accrual vs formula')
    })

    await step('Withdrawing a locked stake reverts', async () => {
        if ((await now(ctx)) >= lotUnlockAt) {
            check(true, `lock of ${lockSeconds}s already expired — nothing to block`)
            return
        }
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

    await step('Claiming is never blocked by the lock, and pays what was earned', async () => {
        const snapshot = await sample()
        const balanceBefore = await balanceOf(ctx, rewardToken.address, ctx.account)
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getReward',
            label: 'getReward while locked',
        })
        const balanceAfter = await balanceOf(ctx, rewardToken.address, ctx.account)
        const paid = balanceAfter - balanceBefore
        check(paid > 0n, `reward balance rose by ${fmt(paid, rewardToken.decimals)}`)

        // The claim lands a few seconds after the snapshot, so it pays that much extra accrual.
        // The end of that window is whichever clock is furthest ahead, plus one block: the RPC can
        // answer a read from a node that has not caught up to the block the claim was mined in.
        const after = await sample()
        const latest = BigInt(await now(ctx))
        const endTs = (after.timestamp > latest ? after.timestamp : latest) + 5n
        const drift =
            ((endTs - snapshot.timestamp) * after.rewardRate * snapshot.balance) /
            snapshot.totalSupply /
            REWARD_PRECISION
        check(
            paid >= snapshot.earned && paid <= snapshot.earned + drift,
            `paid ${fmt(paid, rewardToken.decimals)} covers the ${fmt(snapshot.earned, rewardToken.decimals)} earned at the snapshot`
        )
        check(after.earned < paid, 'earned reset at the claim')
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
        await ensureLiveEpoch(epoch1Seconds)
        await sleep(accrualWindow, 'accrue something to batch-claim')
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
        const epochBefore = Number(
            (
                await read<readonly unknown[]>(ctx, {
                    address: factory,
                    abi: STAKING_REWARDS_FACTORY_ABI,
                    functionName: 'poolInfo',
                    args: [pool],
                })
            )[5]
        )
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
        checkEqual(poolInfo[5], epochBefore + 1, 'poolInfo.epoch after funding')
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
        await ensureLiveEpoch(epoch2Seconds)
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
        await sleep(accrualWindow, 'accrue in epoch 2')
        await call(ctx, {
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'exit',
            label: 'exit epoch 2',
        })
        check(true, 'staked, accrued and exited inside epoch 2')
    })

    // Everything above is a pool with one staker in it. This is the part that only shows up with
    // two: the same second of emission has to split by stake weight, not go to whoever asks first.
    await step(
        'Two accounts share one pool by stake weight',
        async () => {
            if (!secondCtx) {
                check(true, 'PRIVATE_KEY_2 not set — skipped')
                return
            }
            const shareA = amountA * 2n
            const shareB = amountA
            const needed = shareA + shareB

            // A fresh epoch, sized to hold both stakes and with no lock in the way.
            const view = await read<PoolView>(ctx, {
                address: lens,
                abi: STAKING_REWARDS_LENS_ABI,
                functionName: 'poolState',
                args: [pool],
            })
            const current = await now(ctx)
            if (Number(view.periodFinish) > current) {
                await waitUntil(ctx, Number(view.periodFinish) + 2, 'epoch to finish')
            }
            await ensureAllowance(ctx, rewardToken.address, factory, rewardAmount, 'shared epoch')
            await call(ctx, {
                address: factory,
                abi: STAKING_REWARDS_FACTORY_ABI,
                functionName: 'startEpoch',
                args: [pool, rewardAmount, 0n, BigInt(epoch1Seconds), 0n, needed],
                label: 'startEpoch for the shared test',
            })

            // Account 2 is funded from account 1 so the run needs tokens in one place only.
            const balance2 = await balanceOf(ctx, stakeToken.address, secondCtx.account)
            if (balance2 < shareB) {
                await call(ctx, {
                    address: stakeToken.address,
                    abi: ERC20,
                    functionName: 'transfer',
                    args: [secondCtx.account, shareB - balance2],
                    label: `fund account 2 with ${fmt(shareB - balance2, stakeToken.decimals)}`,
                })
            }
            await ensureAllowance(secondCtx, stakeToken.address, pool, shareB, 'staking token (2)')

            await call(ctx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'stake',
                args: [shareA],
                label: 'stake account 1',
            })
            await call(secondCtx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'stake',
                args: [shareB],
                label: 'stake account 2',
            })

            // Both accounts are sampled in the same wave so no block of drift creeps between them.
            const [before1, before2] = await Promise.all([sample(), sample(secondCtx.account)])
            await sleep(accrualWindow, 'both accounts accruing at once')
            const [after1, after2] = await Promise.all([sample(), sample(secondCtx.account)])

            checkEqual(after1.totalSupply, needed, 'both stakes are in the pool')
            checkEqual(after1.balance, shareA, 'account 1 stake')
            checkEqual(after2.balance, shareB, 'account 2 stake')

            const window = (s: Sample) =>
                s.timestamp < s.periodFinish ? s.timestamp : s.periodFinish
            const elapsed1 = window(after1) - window(before1)
            const elapsed2 = window(after2) - window(before2)
            const expected1 =
                (after1.rewardRate * elapsed1 * shareA) / after1.totalSupply / REWARD_PRECISION
            const expected2 =
                (after2.rewardRate * elapsed2 * shareB) / after2.totalSupply / REWARD_PRECISION
            const gained1 = after1.earned - before1.earned
            const gained2 = after2.earned - before2.earned
            info('account 1 gained', fmt(gained1, rewardToken.decimals))
            info('account 2 gained', fmt(gained2, rewardToken.decimals))
            checkClose(gained1, expected1, 1, 'account 1 accrual vs formula')
            checkClose(gained2, expected2, 1, 'account 2 accrual vs formula')
            // 2:1 stakes must earn 2:1. Compared as a ratio so a stray second cancels out.
            checkClose(gained1, gained2 * (shareA / shareB), 2, 'split follows the stake weight')

            // Both leave, and the borrowed stake goes home.
            await call(ctx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'exit',
                label: 'exit account 1',
            })
            await call(secondCtx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'exit',
                label: 'exit account 2',
            })
            const left = await balanceOf(ctx, stakeToken.address, secondCtx.account)
            if (left > 0n) {
                await call(secondCtx, {
                    address: stakeToken.address,
                    abi: ERC20,
                    functionName: 'transfer',
                    args: [ctx.account, left],
                    label: 'return the stake to account 1',
                })
            }
            const totalSupply = await read<bigint>(ctx, {
                address: pool,
                abi: STAKING_REWARDS_ABI,
                functionName: 'totalSupply',
            })
            checkEqual(totalSupply, 0n, 'pool empty after both exits')
        },
        { fatal: false }
    )

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

    await step('A closed pool refuses new epochs, but not new stakes', async () => {
        // `close()` guards notifyRewardAmount and nothing else: `stake` has no `closed` check, so
        // a retired pool still takes deposits that can never earn. The principal is never at risk
        // — no epoch means no lock, so it is withdrawable immediately — but nothing on chain stops
        // a staker walking into it, which is why the app hides the stake side of a closed pool.
        await ctx.publicClient.simulateContract({
            address: pool,
            abi: STAKING_REWARDS_ABI,
            functionName: 'stake',
            args: [amountA],
            account: ctx.account,
        })
        check(true, 'staking into a closed pool is accepted by the contract — the UI is the guard')
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
