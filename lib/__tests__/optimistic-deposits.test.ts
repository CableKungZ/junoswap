import { describe, it, expect, beforeEach } from 'vitest'
import {
    markStaked,
    markUnstaked,
    applyOptimisticDeposits,
    __resetOptimisticDeposits,
} from '@/lib/optimistic-deposits'

const CHAIN = 96
const OWNER = '0xAbC0000000000000000000000000000000000001'

describe('applyOptimisticDeposits', () => {
    beforeEach(() => {
        __resetOptimisticDeposits()
    })

    it('adds a freshly staked tokenId the indexer has not caught up to yet', () => {
        markStaked(CHAIN, OWNER, 42n)
        expect(applyOptimisticDeposits(CHAIN, OWNER, [7n])).toEqual([7n, 42n])
    })

    it('removes a freshly unstaked tokenId the indexer still reports', () => {
        markUnstaked(CHAIN, OWNER, 7n)
        expect(applyOptimisticDeposits(CHAIN, OWNER, [7n, 9n])).toEqual([9n])
    })

    it('settles and stops overriding once the indexer agrees', () => {
        markStaked(CHAIN, OWNER, 42n)
        applyOptimisticDeposits(CHAIN, OWNER, [42n]) // indexer catches up — entry clears

        // A later indexer response that drops 42 (position withdrawn) must be respected,
        // not overridden by the settled entry.
        expect(applyOptimisticDeposits(CHAIN, OWNER, [])).toEqual([])
    })

    it('scopes entries to their own chain and owner', () => {
        markStaked(CHAIN, OWNER, 42n)
        expect(applyOptimisticDeposits(8899, OWNER, [])).toEqual([])
        expect(
            applyOptimisticDeposits(CHAIN, '0xdead000000000000000000000000000000000000', [])
        ).toEqual([])
    })

    it('matches owners case-insensitively', () => {
        markStaked(CHAIN, OWNER.toLowerCase(), 42n)
        expect(applyOptimisticDeposits(CHAIN, OWNER.toUpperCase(), [])).toEqual([42n])
    })

    it('lets a later mark supersede an earlier one for the same tokenId', () => {
        markStaked(CHAIN, OWNER, 42n)
        markUnstaked(CHAIN, OWNER, 42n)
        expect(applyOptimisticDeposits(CHAIN, OWNER, [42n])).toEqual([])
    })

    it('returns the indexer result untouched when there is no owner', () => {
        markStaked(CHAIN, OWNER, 42n)
        expect(applyOptimisticDeposits(CHAIN, undefined, [7n])).toEqual([7n])
    })
})
