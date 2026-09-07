import type { Address } from 'viem'
import type { Token } from '@/types/token'

/** `IStakingRewards.PoolView`, settled to `blockTimestamp` by the lens. */
export interface StakingPoolView {
    stakingToken: Address
    rewardsToken: Address
    creator: Address
    totalSupply: bigint
    /** 0 = uncapped */
    maxStakingPower: bigint
    remainingStakingPower: bigint
    /** per second, scaled by 1e36 */
    rewardRate: bigint
    rewardPerTokenNow: bigint
    /** the running epoch's whole budget */
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

/** `IStakingRewards.UserView` — zeroed when read for the zero address. */
export interface StakingUserView {
    balance: bigint
    earned: bigint
    withdrawable: bigint
    /** 0 when nothing is locked */
    nextUnlockAt: bigint
    lotCount: bigint
    liveLots: bigint
    stakingBalance: bigint
    stakingAllowance: bigint
}

export interface StakingPool {
    address: Address
    epoch: number
    view: StakingPoolView
    user: StakingUserView
    stakingTokenInfo: Token
    rewardTokenInfo: Token
}

export type StakingPoolStatus = 'pending' | 'active' | 'ended' | 'closed'

export type StakingPoolFilter = 'all' | 'active' | 'my-stakes'
