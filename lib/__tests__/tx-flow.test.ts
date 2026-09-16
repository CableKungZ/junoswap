import { describe, it, expect } from 'vitest'
import {
    txPhase,
    parseRevertReason,
    isUserRejection,
    formatStageNumber,
    formatStageText,
    autoRunIndex,
} from '@/lib/tx-flow'

const HASH = '0x7f3a000000000000000000000000000000000000000000000000000000000c21' as const

describe('txPhase', () => {
    it('reports success even while the receipt query still says confirming', () => {
        // useTokenApproval flips isSuccess from an allowance poll before the receipt lands.
        expect(txPhase({ isSuccess: true, isConfirming: true, hash: HASH })).toBe('success')
    })

    it('reports error ahead of a success left over from an earlier attempt', () => {
        expect(txPhase({ isError: true, isSuccess: true, hash: HASH })).toBe('error')
    })

    it('reports a simulation revert only while nothing has been broadcast', () => {
        const simulationError = new Error('reverted')
        expect(txPhase({ simulationError })).toBe('sim-error')
        expect(txPhase({ simulationError, hash: HASH, isConfirming: true })).toBe('confirming')
    })

    it('prefers confirming over a write that is still marked pending', () => {
        expect(txPhase({ isPending: true, isConfirming: true, hash: HASH })).toBe('confirming')
    })

    it('is idle with nothing set', () => {
        expect(txPhase({})).toBe('idle')
    })
})

describe('parseRevertReason', () => {
    it('pulls the decoded revert string out of a viem execution error', () => {
        const message = [
            'ContractFunctionExecutionError: The contract function "mint" reverted.',
            '',
            'Error: Price slippage check',
            '',
            'Contract Call:',
            '  address:   0x1F98431c8aD98523631AE4a59f267346ea31F984',
        ].join('\n')
        expect(parseRevertReason(new Error(message))).toBe('Price slippage check')
    })

    it('falls back to shortMessage when viem decoded no revert string', () => {
        const error = Object.assign(new Error('An unknown RPC error occurred.\nmore noise'), {
            shortMessage: 'Execution reverted for an unknown reason.',
        })
        expect(parseRevertReason(error)).toBe('Execution reverted for an unknown reason.')
    })

    it('names a wallet rejection instead of digging for a revert', () => {
        const error = Object.assign(new Error('User rejected the request.'), { code: 4001 })
        expect(parseRevertReason(error)).toBe('Transaction rejected in wallet')
    })
})

describe('isUserRejection', () => {
    it('matches both the numeric code and the ethers-style string code', () => {
        expect(isUserRejection(Object.assign(new Error('nope'), { code: 4001 }))).toBe(true)
        expect(isUserRejection(Object.assign(new Error('nope'), { code: 'ACTION_REJECTED' }))).toBe(
            true
        )
    })

    it('does not treat a revert as a rejection', () => {
        expect(isUserRejection(new Error('Error: Too little received'))).toBe(false)
    })
})

describe('formatStageNumber', () => {
    it('compacts and trims by magnitude', () => {
        expect(formatStageNumber(100000)).toBe('100,000')
        expect(formatStageNumber(1234.56789)).toBe('1,234.57')
        expect(formatStageNumber(12_345_678)).toBe('12.35M')
        expect(formatStageNumber(3e18)).toBe('3.00e+18')
        expect(formatStageNumber(1.123456789)).toBe('1.1235')
        expect(formatStageNumber(0.000123456)).toBe('0.0001235')
        expect(formatStageNumber(0.00000001)).toBe('<0.0001')
        expect(formatStageNumber(0)).toBe('0')
    })
})

describe('formatStageText', () => {
    it('formats a leading amount and leaves other text alone', () => {
        expect(formatStageText('100000.123456789012')).toBe('100,000.12')
        expect(formatStageText('1,234.567891 KUB')).toBe('1,234.57 KUB')
        expect(formatStageText('Unlimited')).toBe('Unlimited')
        expect(formatStageText('0x70138f…6144e')).toBe('0x70138f…6144e')
        expect(formatStageText('2026-09-16')).toBe('2026-09-16')
    })
})

describe('autoRunIndex', () => {
    it('starts the next ready step once everything before it landed', () => {
        expect(
            autoRunIndex([
                { phase: 'success' },
                { phase: 'success' },
                { phase: 'idle', autoRun: true },
            ])
        ).toBe(2)
    })

    it('never starts the first step, a step still waiting on readiness, or one already running', () => {
        expect(autoRunIndex([{ phase: 'idle', autoRun: true }])).toBeNull()
        expect(autoRunIndex([{ phase: 'success' }, { phase: 'idle', autoRun: false }])).toBeNull()
        expect(autoRunIndex([{ phase: 'success' }, { phase: 'pending', autoRun: true }])).toBeNull()
        expect(autoRunIndex([{ phase: 'success' }, { phase: 'error', autoRun: true }])).toBeNull()
        expect(autoRunIndex([{ phase: 'success' }, { phase: 'success', autoRun: true }])).toBeNull()
    })
})
