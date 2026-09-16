import { describe, it, expect } from 'vitest'
import { txPhase, parseRevertReason, isUserRejection } from '@/lib/tx-flow'

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
