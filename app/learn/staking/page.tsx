import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = {
    title: 'How earning works — Junoswap',
    description:
        'v3Staker, Juno-v3Staker and v2Staker compared: what you lock, how the reward is shared, and which one fits your program.',
}

const PROGRAMS = [
    { id: 'v3', name: 'v3Staker', kind: 'Pool-wide', href: '/earn?tab=lp-farming' },
    { id: 'juno-v3', name: 'Juno-v3Staker', kind: 'Staked-only', href: '/earn?tab=lp-farming' },
    { id: 'v2', name: 'v2Staker', kind: 'Token staking', href: '/earn?tab=token-staking' },
]

/** Key differences only. Anything both LP stakers do identically is left out on purpose. */
const ROWS: { label: string; note?: string; values: [string, string, string] }[] = [
    {
        label: 'Locking Type',
        values: ['NFT', 'NFT', 'TOKEN'],
    },
    {
        label: 'Lockable Liquidity',
        note: 'Can the program hold your stake for a fixed term?',
        values: [
            'False — though the NFT cannot leave the staker until you unstake it',
            'False — though the NFT cannot leave the staker until you unstake it',
            'True — optional lock per deposit',
        ],
    },
    {
        label: 'What you stake',
        values: [
            'A v3 LP position NFT',
            'A v3 LP position NFT',
            'Any ERC-20 / KAP-20, LP tokens included',
        ],
    },
    {
        label: 'Who the reward is split between',
        note: 'The single biggest difference between the two LP stakers.',
        values: [
            'The whole pool — unstaked liquidity dilutes your share',
            'Staked positions only — nothing is lost to liquidity that never staked',
            'Everyone staked in that pool',
        ],
    },
    {
        label: 'Price range matters',
        values: [
            'Yes — you earn only for the time the price spends inside your range',
            'Yes — you earn only for the time the price spends inside your range',
            'No — there is no price range',
        ],
    },
    {
        label: 'What is turned away',
        note: 'Positions the contract refuses to take at all.',
        values: [
            'Only a position with no liquidity',
            'A position with no liquidity, one that is out of range, or one carrying more liquidity than the pool has active — a guard against dust minted at an extreme tick, which an in-range position is never caught by',
            'Nothing, beyond the pool cap and the 256 live-lot limit per account',
        ],
    },
    {
        label: 'Undistributed budget',
        note: 'How much is normally left over is the row above — this is only where it goes.',
        values: [
            'Refunded to the refundee when the farm ends',
            'Refunded to the refundee when the farm ends',
            'Recoverable by the creator once the pool is closed',
        ],
    },
    {
        label: 'Running it again',
        values: [
            'Create a new farm',
            'Create a new farm',
            'Fund the next epoch on the same pool — stakers never unstake',
        ],
    },
    {
        label: 'Cap on total stake',
        note: 'A ceiling on how much can be staked — not the same as what is eligible to stake.',
        values: ['None', 'None', 'Optional cap per epoch'],
    },
    {
        label: 'Reward tokens',
        values: ['One per farm', 'One per farm', 'One per pool, chosen when the pool opens'],
    },
    {
        label: 'Who can create one',
        note: 'Nobody approves your program — but opening one is not always free.',
        values: [
            'Anyone, self-funded. The staker charges nothing; creating through this app pays a protocol fee in the chain’s native currency',
            'Anyone, self-funded. The staker charges nothing; creating through this app pays a protocol fee in the chain’s native currency',
            'Anyone, self-funded. The factory itself may charge a protocol fee, set by its owner and pulled as an ERC-20 alongside the reward',
        ],
    },
    {
        label: 'Claiming',
        values: [
            'Unstake to claim',
            'Unstake to claim',
            'Claim any time — rewards are never locked, even while the stake is',
        ],
    },
]

const DETAILS: { name: string; blurb: string; points: string[] }[] = [
    {
        name: 'v3Staker',
        blurb: 'The canonical Uniswap v3 staker. Your position is measured against the liquidity-seconds of the entire pool.',
        points: [
            'Deposit an LP NFT, stake it into a farm, unstake to collect.',
            'A farm on a pool where only part of the TVL is staked pays out only that part of its budget — the rest goes back to the creator.',
            'Best when you want to reward a pool as a whole and are happy for unstaked liquidity to dilute the rate.',
        ],
    },
    {
        name: 'Juno-v3Staker',
        blurb: 'Our fork, with the reward model replaced: the budget drips at a fixed rate and each second is split between the staked positions only.',
        points: [
            'A fixed budget always reaches the people who actually staked — useful for a launchpad reward that must be paid out in full.',
            'Payouts are scaled by how much of your stake’s life the price spent inside your range; out-of-range time earns nothing.',
            'A position has to be in range to stake, and cannot be larger than the pool’s active liquidity, so dust at an extreme tick cannot dilute real stakers.',
        ],
    },
    {
        name: 'v2Staker',
        blurb: 'Plain single-token staking: stake one token, earn another, on a schedule the pool creator sets.',
        points: [
            'Every deposit is its own lot with its own unlock time, so a later deposit never re-locks an earlier one.',
            'A stake made late in an epoch unlocks at the epoch end, never past the rewards it staked for.',
            'Withdrawing and claiming are separate actions and stay open forever, including after the pool is retired.',
        ],
    },
]

export default function LearnStakingPage() {
    return (
        <div className="flex min-h-screen items-start justify-center p-4 pt-8">
            <div className="w-full max-w-5xl space-y-8">
                <div className="space-y-3">
                    <Link
                        href="/earn"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Earn
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        How earning works
                    </h1>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Three contracts sit behind the Earn page. Two reward liquidity providers and
                        take an LP position NFT — they share one list under LP Farming, tagged
                        <span className="font-medium text-foreground"> Pool-wide</span> or
                        <span className="font-medium text-foreground"> Staked-only</span> — while
                        the third takes plain tokens. They differ in what you lock and how the
                        reward is shared; the rest is detail.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PROGRAMS.map((program) => (
                        <Card key={program.id}>
                            <CardContent className="flex items-center justify-between gap-2 p-4">
                                <div className="min-w-0">
                                    <Link
                                        href={program.href}
                                        className="truncate font-semibold hover:underline"
                                    >
                                        {program.name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground">
                                        {program.kind}
                                    </div>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                    {program.id === 'v2' ? 'TOKEN' : 'NFT'}
                                </Badge>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="space-y-3">
                    <h2 className="text-lg font-semibold sm:text-xl">Side by side</h2>
                    <Card>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-3 px-4 min-w-[180px]">
                                            &nbsp;
                                        </TableHead>
                                        {PROGRAMS.map((program) => (
                                            <TableHead
                                                key={program.id}
                                                className="py-3 px-4 min-w-[200px] text-foreground"
                                            >
                                                {program.name}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ROWS.map((row) => (
                                        <TableRow key={row.label}>
                                            <TableCell className="py-3 px-4 align-top">
                                                <div className="font-medium">{row.label}</div>
                                                {row.note && (
                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                        {row.note}
                                                    </div>
                                                )}
                                            </TableCell>
                                            {row.values.map((value, i) => (
                                                <TableCell
                                                    key={PROGRAMS[i]?.id ?? i}
                                                    className="py-3 px-4 align-top text-sm text-muted-foreground"
                                                >
                                                    {value}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>

                <div className="space-y-3">
                    <h2 className="text-lg font-semibold sm:text-xl">In more detail</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {DETAILS.map((detail) => (
                            <Card key={detail.name}>
                                <CardContent className="space-y-3 p-5">
                                    <h3 className="font-semibold">{detail.name}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {detail.blurb}
                                    </p>
                                    <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                                        {detail.points.map((point) => (
                                            <li key={point} className="flex gap-2">
                                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                    All three are permissionless and self-funded: nobody approves your program, and
                    the reward you put in is the reward that goes out — a creation fee, where one is
                    charged, is taken separately and never out of the reward. None of the staking
                    contracts can be paused, upgraded or swept by an admin.
                </p>

                <Card className="border-border/50 bg-muted/20">
                    <CardContent className="space-y-2 p-5">
                        <h2 className="text-sm font-semibold">Disclaimer</h2>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Junoswap is a frontend interface only. The contracts described on this
                            page are permissionless and run on chain — they are not operated,
                            custodied or controlled by Junoswap, and no admin key of ours can move,
                            freeze or recover the assets you put into them. Anyone can create a farm
                            or a staking pool, and we neither vet nor endorse the ones you see
                            listed.
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Using these contracts is entirely at your own risk. Junoswap accepts no
                            liability for any loss of funds or damage to property arising from their
                            use, including losses caused by smart-contract bugs or exploits, by
                            farms, pools or tokens created by third parties, by impermanent loss or
                            price movement, or by mistakes made when signing a transaction. Verify
                            every contract address and reward token yourself before you stake.
                            Nothing here is financial advice.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
