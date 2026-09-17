import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import { UNISWAP_V3_STAKER_ABI } from '@/lib/abis/uniswap-v3-staker'
import {
    buildUnstakeAndClaimMulticall,
    buildWithdrawMulticall,
    computeIncentiveId,
} from '@/services/mining/staking'
import type { IncentiveKey } from '@/types/earn'

const TESTNET_KEY: IncentiveKey = {
    rewardToken: '0x23352915164527e0AB53Ca5519aec5188aa224A2',
    pool: '0x81182579f4271B910bF108913Be78F0D9C44AaBa',
    startTime: 1764152820,
    endTime: 1795688820,
    refundee: '0xCA811301C650C92fD45ed32A81C0B757C61595b6',
}

describe('computeIncentiveId', () => {
    it('matches the on-chain id for a live incentive', () => {
        expect(computeIncentiveId(TESTNET_KEY)).toBe(
            '0x26d52c050f9b613112df94d71586188fc3896697329fa5b7bc29476dfde5fb70'
        )
    })

    it('changes when any key field changes', () => {
        const base = computeIncentiveId(TESTNET_KEY)
        expect(
            computeIncentiveId({ ...TESTNET_KEY, startTime: TESTNET_KEY.startTime + 1 })
        ).not.toBe(base)
        expect(computeIncentiveId({ ...TESTNET_KEY, refundee: TESTNET_KEY.pool })).not.toBe(base)
    })
})

describe('unstake then withdraw', () => {
    const RECIPIENT = '0x1111111111111111111111111111111111111111'
    const calls = (data: readonly `0x${string}`[]) =>
        data.map((d) => decodeFunctionData({ abi: UNISWAP_V3_STAKER_ABI, data: d }).functionName)

    it('unstakes every position before the single claim, and never withdraws', () => {
        expect(calls(buildUnstakeAndClaimMulticall([1n, 2n], TESTNET_KEY, RECIPIENT))).toEqual([
            'unstakeToken',
            'unstakeToken',
            'claimReward',
        ])
        expect(buildUnstakeAndClaimMulticall([], TESTNET_KEY, RECIPIENT)).toEqual([])
    })

    it('withdraws each position on its own', () => {
        expect(calls(buildWithdrawMulticall([1n, 2n], RECIPIENT))).toEqual([
            'withdrawToken',
            'withdrawToken',
        ])
    })
})
