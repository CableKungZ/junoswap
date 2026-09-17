import { encodeFunctionData, encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import type { IncentiveKey, UnstakeParams } from '@/types/earn'
import { UNISWAP_V3_STAKER_ABI } from '@/lib/abis/uniswap-v3-staker'

/**
 * The staker keys every incentive by `keccak256(abi.encode(key))`, which is the same encoding
 * `safeTransferFrom` carries as its stake payload — so both paths share one encoder and a freshly
 * created incentive can be identified before the indexer has seen it.
 */
export function computeIncentiveId(key: IncentiveKey): Hex {
    return keccak256(encodeIncentiveKeyData(key))
}

export function encodeIncentiveKeyData(key: IncentiveKey): Hex {
    return encodeAbiParameters(
        [
            {
                type: 'tuple',
                components: [
                    { type: 'address', name: 'rewardToken' },
                    { type: 'address', name: 'pool' },
                    { type: 'uint256', name: 'startTime' },
                    { type: 'uint256', name: 'endTime' },
                    { type: 'address', name: 'refundee' },
                ],
            },
        ],
        [
            {
                rewardToken: key.rewardToken,
                pool: key.pool,
                startTime: BigInt(key.startTime),
                endTime: BigInt(key.endTime),
                refundee: key.refundee,
            },
        ]
    )
}

function encodeUnstakeToken(params: UnstakeParams): Hex {
    return encodeFunctionData({
        abi: UNISWAP_V3_STAKER_ABI,
        functionName: 'unstakeToken',
        args: [
            {
                rewardToken: params.incentiveKey.rewardToken,
                pool: params.incentiveKey.pool,
                startTime: BigInt(params.incentiveKey.startTime),
                endTime: BigInt(params.incentiveKey.endTime),
                refundee: params.incentiveKey.refundee,
            },
            params.tokenId,
        ],
    })
}

function encodeWithdrawToken(tokenId: bigint, to: Address): Hex {
    return encodeFunctionData({
        abi: UNISWAP_V3_STAKER_ABI,
        functionName: 'withdrawToken',
        args: [tokenId, to, '0x'],
    })
}

function encodeClaimReward(rewardToken: Address, to: Address, amountRequested: bigint): Hex {
    return encodeFunctionData({
        abi: UNISWAP_V3_STAKER_ABI,
        functionName: 'claimReward',
        args: [rewardToken, to, amountRequested],
    })
}

/**
 * Unstakes positions from one farm and collects their rewards. Each `unstakeToken` credits the
 * depositor's reward balance, so one `claimReward` after the batch pays out all of them.
 */
export function buildUnstakeAndClaimMulticall(
    tokenIds: readonly bigint[],
    incentiveKey: IncentiveKey,
    recipient: Address
): Hex[] {
    if (tokenIds.length === 0) return []
    return [
        ...tokenIds.map((tokenId) => encodeUnstakeToken({ tokenId, incentiveKey })),
        encodeClaimReward(incentiveKey.rewardToken, recipient, 0n), // 0n = claim all
    ]
}

/** Returns the NFTs. A staked token cannot move, so this only succeeds after the unstake lands. */
export function buildWithdrawMulticall(tokenIds: readonly bigint[], recipient: Address): Hex[] {
    return tokenIds.map((tokenId) => encodeWithdrawToken(tokenId, recipient))
}
