import { formatUnits } from 'viem'
import type { StakingPool, StakingPoolStatus, StakingPoolView } from '@/types/staking'

/** `rewardRate` and `rewardPerTokenStored` are scaled by 1e36 in StakingRewards. */
export const REWARD_PRECISION = 10n ** 36n

const SECONDS_PER_YEAR = 31_536_000

export function getStakingStatus(view: StakingPoolView, nowSeconds: number): StakingPoolStatus {
    if (view.closed) return 'closed'
    if (nowSeconds < Number(view.startTime)) return 'pending'
    return nowSeconds < Number(view.periodFinish) ? 'active' : 'ended'
}

/** Reward tokens emitted per second, in whole units. */
export function rewardPerSecond(view: StakingPoolView, rewardDecimals: number): number {
    if (view.rewardRate === 0n) return 0
    return Number(formatUnits(view.rewardRate / REWARD_PRECISION, rewardDecimals))
}

/**
 * Annualised reward value over staked value, in percent. Needs both token prices; returns null
 * when either is unknown or nothing is staked yet (an APR against a zero stake is meaningless).
 */
export function getStakingApr(
    pool: StakingPool,
    prices: { stakingUsd?: number; rewardUsd?: number }
): number | null {
    const { stakingUsd, rewardUsd } = prices
    if (stakingUsd === undefined || rewardUsd === undefined) return null
    if (pool.view.totalSupply === 0n || pool.view.rewardRate === 0n) return null

    const stakedTokens = Number(formatUnits(pool.view.totalSupply, pool.stakingTokenInfo.decimals))
    const stakedValue = stakedTokens * stakingUsd
    if (stakedValue <= 0) return null

    const rewardValuePerYear =
        rewardPerSecond(pool.view, pool.rewardTokenInfo.decimals) * SECONDS_PER_YEAR * rewardUsd
    return (rewardValuePerYear / stakedValue) * 100
}

/** Pools the viewer has something in — a live stake or rewards still to claim. */
export function hasPosition(pool: StakingPool): boolean {
    return pool.user.balance > 0n || pool.user.earned > 0n
}

export function filterStakingPools(
    pools: readonly StakingPool[],
    filter: 'all' | 'active' | 'my-stakes',
    nowSeconds: number
): StakingPool[] {
    if (filter === 'my-stakes') return pools.filter(hasPosition)
    if (filter === 'active')
        return pools.filter((p) => getStakingStatus(p.view, nowSeconds) === 'active')
    return [...pools]
}

/** Active pools first, then by staked size — an empty live pool still beats a finished one. */
export function sortStakingPools(pools: readonly StakingPool[], nowSeconds: number): StakingPool[] {
    const rank: Record<StakingPoolStatus, number> = { active: 0, pending: 1, ended: 2, closed: 3 }
    return [...pools].sort((a, b) => {
        const byStatus =
            rank[getStakingStatus(a.view, nowSeconds)] - rank[getStakingStatus(b.view, nowSeconds)]
        if (byStatus !== 0) return byStatus
        return a.view.totalSupply > b.view.totalSupply ? -1 : 1
    })
}
