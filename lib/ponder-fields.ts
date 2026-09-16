export interface LaunchTokenEntity {
    tokenAddr: string
    chainId: number
    creator: string
    name: string | null
    symbol: string | null
    logo: string | null
    description: string | null
    link1: string | null
    link2: string | null
    link3: string | null
    createdTime: number
    isGraduated: number | null
    graduatedAt: number | null
    createdAtBlock: number
    /** Which launchpad minted this token — 'junoswap' or a third party (e.g. 'durianfun'). */
    launchpadId: string | null
    /** Third-party bonding-curve market contract, pre-graduation (durianfun and future third parties). */
    market: string | null
    /** Graduated pool address, any platform — resolves the fee-tier-guessing that broke for
     *  third-party dexes whose default fee tier doesn't match Junoswap's own. */
    ammPool: string | null
    graduationTarget: number | null
}

export const LAUNCH_TOKEN_DETAIL_FIELDS = [
    'tokenAddr',
    'creator',
    'name',
    'symbol',
    'logo',
    'description',
    'link1',
    'link2',
    'link3',
    'createdTime',
    'isGraduated',
    'graduatedAt',
    'launchpadId',
    'market',
    'ammPool',
    'graduationTarget',
] as const satisfies readonly (keyof LaunchTokenEntity)[]

export const LAUNCH_TOKEN_META_FIELDS = [
    'tokenAddr',
    'name',
    'symbol',
    'logo',
] as const satisfies readonly (keyof LaunchTokenEntity)[]
