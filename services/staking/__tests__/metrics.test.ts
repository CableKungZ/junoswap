import { describe, expect, it } from 'vitest'
import {
    REWARD_PRECISION,
    getStakingApr,
    getStakingStatus,
    sortStakingPools,
} from '@/services/staking/metrics'
import type { StakingPool, StakingPoolView } from '@/types/staking'

const ZERO = '0x0000000000000000000000000000000000000000' as const

function view(overrides: Partial<StakingPoolView> = {}): StakingPoolView {
    return {
        stakingToken: ZERO,
        rewardsToken: ZERO,
        creator: ZERO,
        totalSupply: 0n,
        maxStakingPower: 0n,
        remainingStakingPower: 0n,
        rewardRate: 0n,
        rewardPerTokenNow: 0n,
        rewardForDuration: 0n,
        unallocatedRewards: 0n,
        rewardsBalance: 0n,
        startTime: 1000n,
        periodFinish: 2000n,
        lastUpdateTime: 1000n,
        rewardsDuration: 1000n,
        lockDuration: 0n,
        blockTimestamp: 1000n,
        closed: false,
        ...overrides,
    }
}

function pool(overrides: Partial<StakingPool> = {}): StakingPool {
    const token = { address: ZERO, symbol: 'T', name: 'T', decimals: 18, chainId: 96 }
    return {
        address: ZERO,
        epoch: 1,
        view: view(),
        user: {
            balance: 0n,
            earned: 0n,
            withdrawable: 0n,
            nextUnlockAt: 0n,
            lotCount: 0n,
            liveLots: 0n,
            stakingBalance: 0n,
            stakingAllowance: 0n,
        },
        stakingTokenInfo: token,
        rewardTokenInfo: token,
        ...overrides,
    }
}

describe('getStakingStatus', () => {
    it('reports closed ahead of the schedule', () => {
        expect(getStakingStatus(view({ closed: true }), 1500)).toBe('closed')
    })

    it('walks pending → active → ended with the clock', () => {
        expect(getStakingStatus(view(), 999)).toBe('pending')
        expect(getStakingStatus(view(), 1500)).toBe('active')
        expect(getStakingStatus(view(), 2000)).toBe('ended')
    })
})

describe('getStakingApr', () => {
    it('annualises the reward rate against the staked value', () => {
        // 1 token/second of a $1 reward against 31,536,000 staked $1 tokens = 100% a year
        const p = pool({
            view: view({
                rewardRate: 10n ** 18n * REWARD_PRECISION,
                totalSupply: 31_536_000n * 10n ** 18n,
            }),
        })
        expect(getStakingApr(p, { stakingUsd: 1, rewardUsd: 1 })).toBeCloseTo(100)
    })

    it('has no answer without prices or without a stake', () => {
        const p = pool({ view: view({ rewardRate: 10n ** 18n * REWARD_PRECISION }) })
        expect(getStakingApr(p, { stakingUsd: 1 })).toBeNull()
        expect(getStakingApr(p, { stakingUsd: 1, rewardUsd: 1 })).toBeNull()
    })
})

describe('sortStakingPools', () => {
    it('puts live pools first and orders them by size', () => {
        const ended = pool({ address: '0x1', view: view({ periodFinish: 1200n }) })
        const small = pool({ address: '0x2', view: view({ totalSupply: 1n }) })
        const big = pool({ address: '0x3', view: view({ totalSupply: 2n }) })
        expect(sortStakingPools([ended, small, big], 1500).map((p) => p.address)).toEqual([
            '0x3',
            '0x2',
            '0x1',
        ])
    })
})
