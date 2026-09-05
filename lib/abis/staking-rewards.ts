// Generated from liquidity-staker artifacts — do not edit by hand.
export const STAKING_REWARDS_FACTORY_ABI = [
    {
        type: 'constructor',
        inputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'acceptOwnership',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'claimAll',
        inputs: [
            {
                name: 'poolAddresses',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'deploy',
        inputs: [
            {
                name: 'stakingToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'rewardsToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'rewardAmount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'startTime',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'rewardsDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'lockDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'maxStakingPower',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'stakingRewards',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'feeAmount',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'feeReceiver',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'feeToken',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'pendingOwner',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolInfo',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'creator',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'startTime',
                type: 'uint40',
                internalType: 'uint40',
            },
            {
                name: 'rewardsDuration',
                type: 'uint32',
                internalType: 'uint32',
            },
            {
                name: 'stakingToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'lockDuration',
                type: 'uint32',
                internalType: 'uint32',
            },
            {
                name: 'epoch',
                type: 'uint32',
                internalType: 'uint32',
            },
            {
                name: 'rewardsToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'rewardAmount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'maxStakingPower',
                type: 'uint128',
                internalType: 'uint128',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'pools',
        inputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolsByCreator',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolsByCreatorLength',
        inputs: [
            {
                name: 'creator',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolsLength',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'renounceOwnership',
        inputs: [],
        outputs: [],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'setServiceFee',
        inputs: [
            {
                name: '_feeToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_feeAmount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_feeReceiver',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'startEpoch',
        inputs: [
            {
                name: 'stakingRewards',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'rewardAmount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'startTime',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'rewardsDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'lockDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'maxStakingPower',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'transferOwnership',
        inputs: [
            {
                name: 'newOwner',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'Deployed',
        inputs: [
            {
                name: 'stakingToken',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'rewardsToken',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'stakingRewards',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'deployer',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
            {
                name: 'rewardAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'startTime',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'rewardsDuration',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'lockDuration',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'maxStakingPower',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'EpochStarted',
        inputs: [
            {
                name: 'stakingRewards',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'epoch',
                type: 'uint256',
                indexed: true,
                internalType: 'uint256',
            },
            {
                name: 'rewardAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'startTime',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'rewardsDuration',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'lockDuration',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'maxStakingPower',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OwnershipTransferStarted',
        inputs: [
            {
                name: 'previousOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OwnershipTransferred',
        inputs: [
            {
                name: 'previousOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'ServiceFeeChanged',
        inputs: [
            {
                name: 'feeToken',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
            {
                name: 'feeAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'feeReceiver',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
] as const

export const STAKING_REWARDS_LENS_ABI = [
    {
        type: 'function',
        name: 'poolState',
        inputs: [
            {
                name: 'pool',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'p',
                type: 'tuple',
                internalType: 'struct IStakingRewards.PoolView',
                components: [
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'totalSupply',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'remainingStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardRate',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardPerTokenNow',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardForDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'unallocatedRewards',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'startTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'periodFinish',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lastUpdateTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'blockTimestamp',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'closed',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'state',
        inputs: [
            {
                name: 'pool',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'lotStart',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'lotCount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'poolView',
                type: 'tuple',
                internalType: 'struct IStakingRewards.PoolView',
                components: [
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'totalSupply',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'remainingStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardRate',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardPerTokenNow',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardForDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'unallocatedRewards',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'startTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'periodFinish',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lastUpdateTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'blockTimestamp',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'closed',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
            {
                name: 'userView',
                type: 'tuple',
                internalType: 'struct IStakingRewards.UserView',
                components: [
                    {
                        name: 'balance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'earned',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'withdrawable',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'nextUnlockAt',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lotCount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'liveLots',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingAllowance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
            {
                name: 'lots',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.Deposit[]',
                components: [
                    {
                        name: 'amount',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                    {
                        name: 'stakedAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'unlockAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'states',
        inputs: [
            {
                name: 'pools',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'poolViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.PoolView[]',
                components: [
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'totalSupply',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'remainingStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardRate',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardPerTokenNow',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardForDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'unallocatedRewards',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'startTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'periodFinish',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lastUpdateTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'blockTimestamp',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'closed',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
            {
                name: 'userViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.UserView[]',
                components: [
                    {
                        name: 'balance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'earned',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'withdrawable',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'nextUnlockAt',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lotCount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'liveLots',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingAllowance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'statesByCreator',
        inputs: [
            {
                name: 'factory',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'creator',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'start',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'count',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'total',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'pools',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'infos',
                type: 'tuple[]',
                internalType: 'struct StakingRewardsFactory.StakingRewardsInfo[]',
                components: [
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'startTime',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'epoch',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardAmount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                ],
            },
            {
                name: 'poolViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.PoolView[]',
                components: [
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'totalSupply',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'remainingStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardRate',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardPerTokenNow',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardForDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'unallocatedRewards',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'startTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'periodFinish',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lastUpdateTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'blockTimestamp',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'closed',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
            {
                name: 'userViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.UserView[]',
                components: [
                    {
                        name: 'balance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'earned',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'withdrawable',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'nextUnlockAt',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lotCount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'liveLots',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingAllowance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'statesByFactory',
        inputs: [
            {
                name: 'factory',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'start',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'count',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'total',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'pools',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'infos',
                type: 'tuple[]',
                internalType: 'struct StakingRewardsFactory.StakingRewardsInfo[]',
                components: [
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'startTime',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'epoch',
                        type: 'uint32',
                        internalType: 'uint32',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardAmount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                ],
            },
            {
                name: 'poolViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.PoolView[]',
                components: [
                    {
                        name: 'stakingToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'rewardsToken',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'creator',
                        type: 'address',
                        internalType: 'address',
                    },
                    {
                        name: 'totalSupply',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'maxStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'remainingStakingPower',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardRate',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardPerTokenNow',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardForDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'unallocatedRewards',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'startTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'periodFinish',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lastUpdateTime',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'rewardsDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lockDuration',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'blockTimestamp',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'closed',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
            {
                name: 'userViews',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.UserView[]',
                components: [
                    {
                        name: 'balance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'earned',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'withdrawable',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'nextUnlockAt',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lotCount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'liveLots',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingAllowance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'userState',
        inputs: [
            {
                name: 'pool',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'u',
                type: 'tuple',
                internalType: 'struct IStakingRewards.UserView',
                components: [
                    {
                        name: 'balance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'earned',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'withdrawable',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'nextUnlockAt',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'lotCount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'liveLots',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingBalance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'stakingAllowance',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
] as const

export const STAKING_REWARDS_ABI = [
    {
        type: 'constructor',
        inputs: [
            {
                name: '_rewardsDistribution',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_rewardsToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_stakingToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_creator',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_startTime',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_rewardsDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_lockDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_maxStakingPower',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'MAX_DURATION',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'MAX_LIVE_LOTS',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'PRECISION',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'close',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'closed',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'creator',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'earned',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'exit',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getReward',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getRewardFor',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getRewardForDuration',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getUserInfoByIndex',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'index',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'tuple',
                internalType: 'struct IStakingRewards.Deposit',
                components: [
                    {
                        name: 'amount',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                    {
                        name: 'stakedAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'unlockAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getUserInfos',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.Deposit[]',
                components: [
                    {
                        name: 'amount',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                    {
                        name: 'stakedAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'unlockAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getUserInfosPaged',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'start',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'count',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'page',
                type: 'tuple[]',
                internalType: 'struct IStakingRewards.Deposit[]',
                components: [
                    {
                        name: 'amount',
                        type: 'uint128',
                        internalType: 'uint128',
                    },
                    {
                        name: 'stakedAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                    {
                        name: 'unlockAt',
                        type: 'uint40',
                        internalType: 'uint40',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'lastTimeRewardApplicable',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'lastUpdateTime',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint40',
                internalType: 'uint40',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'liveLots',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'lockDuration',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint32',
                internalType: 'uint32',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'maxStakingPower',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint128',
                internalType: 'uint128',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'nextUnlockAt',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'at',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'notifyRewardAmount',
        inputs: [
            {
                name: 'reward',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_startTime',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_rewardsDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_lockDuration',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: '_maxStakingPower',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'periodFinish',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint40',
                internalType: 'uint40',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'recoverUnallocatedRewards',
        inputs: [],
        outputs: [
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'remainingStakingPower',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardPerToken',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardPerTokenStored',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardRate',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewards',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardsDistribution',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardsDuration',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint32',
                internalType: 'uint32',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'rewardsToken',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'contract IERC20',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'stake',
        inputs: [
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'stakeWithPermit',
        inputs: [
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'deadline',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'v',
                type: 'uint8',
                internalType: 'uint8',
            },
            {
                name: 'r',
                type: 'bytes32',
                internalType: 'bytes32',
            },
            {
                name: 's',
                type: 'bytes32',
                internalType: 'bytes32',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'stakingAllowance',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'stakingToken',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'contract IERC20',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'startTime',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint40',
                internalType: 'uint40',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'totalSupply',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'totalUserStakedIndex',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'unallocatedRewards',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'userRewardPerTokenPaid',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'withdraw',
        inputs: [
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'withdrawFrom',
        inputs: [
            {
                name: 'index',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'withdrawableOf',
        inputs: [
            {
                name: 'user',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'Closed',
        inputs: [
            {
                name: 'timestamp',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RewardAdded',
        inputs: [
            {
                name: 'reward',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RewardPaid',
        inputs: [
            {
                name: 'user',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'reward',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'RewardsRecovered',
        inputs: [
            {
                name: 'to',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Staked',
        inputs: [
            {
                name: 'user',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Withdrawn',
        inputs: [
            {
                name: 'user',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
] as const
