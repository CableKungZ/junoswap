import type { Address } from 'viem'
import type {
    CreateIncentiveError,
    CreateIncentiveForm,
    IncentiveKey,
    StakerLimits,
} from '@/types/earn'
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
    formatDuration,
} from '@/lib/duration'

/**
 * A "start now" incentive still has to clear `startTime >= block.timestamp` when the tx mines, so
 * the start is pushed a little into the future and snapped to the next minute. The snap is what
 * keeps the simulate args stable: without it every render would produce a new timestamp and
 * re-simulate.
 */
export const START_NOW_BUFFER_SECONDS = 120
export const START_QUANTUM_SECONDS = 60

/** Canonical UniswapV3Staker deploy values, used only when the chain's staker won't answer. */
export const FALLBACK_STAKER_LIMITS: StakerLimits = {
    maxIncentiveDuration: 63_072_000,
    maxIncentiveStartLeadTime: 2_592_000,
}

export interface DurationPreset {
    label: string
    seconds: number
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
    { label: '7 days', seconds: 7 * SECONDS_PER_DAY },
    { label: '14 days', seconds: 14 * SECONDS_PER_DAY },
    { label: '30 days', seconds: 30 * SECONDS_PER_DAY },
    { label: '90 days', seconds: 90 * SECONDS_PER_DAY },
]

/** Short enough to watch a farm start, pay out and end inside one test session. */
export const TESTNET_DURATION_PRESETS: readonly DurationPreset[] = [
    { label: '10 min', seconds: 10 * SECONDS_PER_MINUTE },
    { label: '1 hour', seconds: SECONDS_PER_HOUR },
    { label: '1 day', seconds: SECONDS_PER_DAY },
    { label: '7 days', seconds: 7 * SECONDS_PER_DAY },
]

export const DEFAULT_DURATION_SECONDS = 30 * SECONDS_PER_DAY

export function createEmptyIncentiveForm(): CreateIncentiveForm {
    return {
        pool: null,
        rewardToken: null,
        rewardAmount: '',
        startMode: 'now',
        scheduledStart: null,
        durationSeconds: DEFAULT_DURATION_SECONDS,
    }
}

export function resolveStartTime(form: CreateIncentiveForm, now: number): number | null {
    if (form.startMode === 'scheduled') return form.scheduledStart
    const earliest = now + START_NOW_BUFFER_SECONDS
    return Math.ceil(earliest / START_QUANTUM_SECONDS) * START_QUANTUM_SECONDS
}

/**
 * Decimal-aware parse that never throws. Excess fraction digits are truncated rather than rounded,
 * so the amount a creator sees is never more than the amount they are asked to approve.
 */
export function parseRewardAmount(amount: string, decimals: number): bigint | null {
    const trimmed = amount.trim()
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
    const [whole = '0', fraction = ''] = trimmed.split('.')
    const truncated = fraction.padEnd(decimals, '0').slice(0, decimals)
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(truncated || '0')
}

export interface ValidationContext {
    now: number
    balance: bigint
    limits: StakerLimits
    account: Address | undefined
}

/**
 * Every `require` in `UniswapV3Staker.createIncentive` has a counterpart here, so a creator finds
 * out in the form rather than at the wallet confirmation.
 */
export function validateCreateIncentive(
    form: CreateIncentiveForm,
    ctx: ValidationContext
): CreateIncentiveError[] {
    const errors: CreateIncentiveError[] = []

    if (!ctx.account) errors.push('NO_ACCOUNT')
    if (!form.pool) errors.push('NO_POOL')
    if (!form.rewardToken) errors.push('NO_REWARD_TOKEN')

    if (form.rewardToken) {
        const reward = parseRewardAmount(form.rewardAmount, form.rewardToken.decimals)
        if (reward === null) {
            if (form.rewardAmount.trim() === '') errors.push('REWARD_ZERO')
            else errors.push('REWARD_INVALID')
        } else if (reward === 0n) {
            errors.push('REWARD_ZERO')
        } else if (reward > ctx.balance) {
            errors.push('REWARD_EXCEEDS_BALANCE')
        }
    }

    const startTime = resolveStartTime(form, ctx.now)
    if (startTime === null) {
        errors.push('START_MISSING')
    } else if (startTime < ctx.now) {
        errors.push('START_IN_PAST')
    } else if (startTime - ctx.now > ctx.limits.maxIncentiveStartLeadTime) {
        errors.push('START_TOO_FAR')
    }

    if (form.durationSeconds <= 0) {
        errors.push('DURATION_ZERO')
    } else if (form.durationSeconds > ctx.limits.maxIncentiveDuration) {
        errors.push('DURATION_TOO_LONG')
    }

    return errors
}

export function buildIncentiveKey(
    form: CreateIncentiveForm,
    ctx: Pick<ValidationContext, 'now' | 'account'>
): IncentiveKey | null {
    const startTime = resolveStartTime(form, ctx.now)
    if (!form.pool || !form.rewardToken || !ctx.account || startTime === null) return null
    if (form.durationSeconds <= 0) return null

    return {
        rewardToken: form.rewardToken.address as Address,
        pool: form.pool.address,
        startTime,
        endTime: startTime + form.durationSeconds,
        refundee: ctx.account,
    }
}

export interface RewardRate {
    perDay: number
    perHour: number
}

export function calculateRewardRate(
    reward: bigint,
    decimals: number,
    durationSeconds: number
): RewardRate {
    if (reward <= 0n || durationSeconds <= 0) return { perDay: 0, perHour: 0 }
    const total = Number(reward) / 10 ** decimals
    return {
        perDay: (total * SECONDS_PER_DAY) / durationSeconds,
        perHour: (total * SECONDS_PER_HOUR) / durationSeconds,
    }
}

export function describeCreateIncentiveError(
    error: CreateIncentiveError,
    ctx: { limits: StakerLimits; rewardSymbol?: string }
): string {
    switch (error) {
        case 'NO_ACCOUNT':
            return 'Connect your wallet'
        case 'NO_POOL':
            return 'Select a pool'
        case 'NO_REWARD_TOKEN':
            return 'Select a reward token'
        case 'REWARD_ZERO':
            return 'Enter a reward amount'
        case 'REWARD_INVALID':
            return 'Enter a valid number'
        case 'REWARD_EXCEEDS_BALANCE':
            return ctx.rewardSymbol ? `Not enough ${ctx.rewardSymbol}` : 'Not enough of that token'
        case 'START_MISSING':
            return 'Pick a start time'
        case 'START_IN_PAST':
            return 'Start time has already passed'
        case 'START_TOO_FAR':
            return `Start within ${formatDuration(ctx.limits.maxIncentiveStartLeadTime)} from now`
        case 'DURATION_ZERO':
            return 'Choose how long the farm runs'
        case 'DURATION_TOO_LONG':
            return `A farm can run for at most ${formatDuration(ctx.limits.maxIncentiveDuration)}`
    }
}

/** The first error worth surfacing on the submit button, in the order a creator fills the form. */
const ERROR_PRIORITY: readonly CreateIncentiveError[] = [
    'NO_ACCOUNT',
    'NO_POOL',
    'NO_REWARD_TOKEN',
    'REWARD_ZERO',
    'REWARD_INVALID',
    'REWARD_EXCEEDS_BALANCE',
    'START_MISSING',
    'START_IN_PAST',
    'START_TOO_FAR',
    'DURATION_ZERO',
    'DURATION_TOO_LONG',
]

export function primaryError(errors: CreateIncentiveError[]): CreateIncentiveError | null {
    if (errors.length === 0) return null
    for (const candidate of ERROR_PRIORITY) {
        if (errors.includes(candidate)) return candidate
    }
    return errors[0] ?? null
}
