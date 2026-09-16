'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TxFlowDialog, type TxStep } from '@/components/ui/tx-flow-dialog'
import { TxStageFlow, TxStageRecord, type TxSide } from '@/components/ui/tx-stage'
import { cn } from '@/lib/utils'
import { playTxSound, isTxSoundEnabled, setTxSoundEnabled, type TxSound } from '@/lib/tx-sfx'
import type { TxPhase } from '@/lib/tx-flow'

const PHASES: TxPhase[] = ['idle', 'pending', 'confirming', 'success', 'error', 'sim-error']
const SOUNDS: TxSound[] = ['submit', 'step', 'success', 'error']
const CHAIN_ID = 96

const KUB = { symbol: 'KUB' }
const JUNO = { symbol: 'JUNO' }
const HASH = '0x7f3ac0de0000000000000000000000000000000000000000000000000000ac21' as const

/** A revert shaped the way viem actually reports one, so the panel gets real input. */
const SIM_ERROR = Object.assign(
    new Error(
        [
            'ContractFunctionExecutionError: The contract function "mint" reverted.',
            '',
            'Error: Price slippage check',
            '',
            'Contract Call:',
            '  address:   0x1F98431c8aD98523631AE4a59f267346ea31F984',
            '  function:  mint((address,address,uint24,int24,int24,uint256,uint256))',
            '  sender:    0x7f3a000000000000000000000000000000000ac21',
            '',
            'Version: viem@2.25.0',
        ].join('\n')
    ),
    { shortMessage: 'The contract function "mint" reverted.' }
)

const SIDES: Record<string, { from: TxSide; to: TxSide }> = {
    Swap: {
        from: { kind: 'token', token: KUB, amount: '1.5' },
        to: { kind: 'token', token: JUNO, amount: '318.42', countTo: 318.42, displayDecimals: 2 },
    },
    Approve: {
        from: { kind: 'token', token: KUB, amount: 'Wallet' },
        to: { kind: 'contract', label: 'Juno Router', amount: 'Unlimited' },
    },
    Stake: {
        from: { kind: 'token', token: JUNO, amount: '5,000' },
        to: { kind: 'contract', label: 'JUNO Pool', amount: '5,000', countTo: 5000 } as TxSide,
    },
    'Stake NFT': {
        from: {
            kind: 'position',
            tokenId: 12345n,
            feeTier: 3000,
            inRange: true,
            token0: JUNO,
            token1: KUB,
        },
        to: { kind: 'contract', label: 'Farm staker', amount: 'Staked' },
    },
    'Unstake 3 NFTs': {
        from: {
            kind: 'position',
            tokenId: 12345n,
            count: 3,
            feeTier: 3000,
            inRange: false,
            token0: JUNO,
            token1: KUB,
        },
        to: { kind: 'token', token: JUNO, amount: '148.06', countTo: 148.06, displayDecimals: 4 },
    },
}

const RECORD_ROWS: [string, string][] = [
    ['Pair', 'JUNO / KUB'],
    ['Fee tier', '0.30%'],
    ['Deposit', '1.5 KUB + 318.42 JUNO'],
    ['Range', '0.0042 – 0.0061'],
]

export default function TxMotionDevPage() {
    const [phase, setPhase] = useState<TxPhase>('confirming')
    const [flowOpen, setFlowOpen] = useState(false)
    const [stepCount, setStepCount] = useState(3)
    const [soundOn, setSoundOn] = useState(true)
    // Read after mount: localStorage during render would not match the server's HTML.
    useEffect(() => setSoundOn(isTxSoundEnabled()), [])

    /**
     * The dialog derives everything from step phases, so driving it here means replaying
     * a scripted flow rather than faking its internals.
     */
    const [liveStep, setLiveStep] = useState(0)
    const [livePhase, setLivePhase] = useState<TxPhase>('pending')

    const labels = ['Approve KUB', 'Approve JUNO', 'Mint liquidity'].slice(-stepCount)
    const steps: TxStep[] = labels.map((label, i) => ({
        label,
        phase: i < liveStep ? 'success' : i === liveStep ? livePhase : 'idle',
        hash: i < liveStep || (i === liveStep && livePhase !== 'pending') ? HASH : undefined,
        error: livePhase === 'sim-error' ? SIM_ERROR : undefined,
        run: () => {
            setLiveStep(i)
            setLivePhase('pending')
        },
        renderStage: (p) =>
            label.startsWith('Mint') ? (
                <TxStageRecord phase={p} chainId={CHAIN_ID} hash={HASH} rows={RECORD_ROWS} />
            ) : (
                <TxStageFlow
                    phase={p}
                    chainId={CHAIN_ID}
                    hash={HASH}
                    from={SIDES.Approve!.from}
                    to={SIDES.Approve!.to}
                />
            ),
    }))

    const playFlow = () => {
        setLiveStep(0)
        setLivePhase('pending')
        setFlowOpen(true)
        const timers: ReturnType<typeof setTimeout>[] = []
        let t = 0
        labels.forEach((_, i) => {
            timers.push(setTimeout(() => (setLiveStep(i), setLivePhase('pending')), t))
            timers.push(setTimeout(() => setLivePhase('confirming'), t + 1400))
            timers.push(setTimeout(() => setLivePhase('success'), t + 3600))
            t += 4400
        })
    }

    return (
        <div className="container max-w-5xl py-10">
            <header className="grid gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Dev · not linked from the app
                </span>
                <h1 className="text-3xl font-bold tracking-tight">Transaction motion & sound</h1>
                <p className="max-w-[62ch] text-sm text-muted-foreground">
                    Every stage layout in every phase, plus the four synthesized sounds. Nothing
                    here touches a chain — the stages are fed fixed values so the motion can be
                    judged on its own.
                </p>
            </header>

            <section className="mt-8 grid gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Sound</h2>
                <p className="text-sm text-muted-foreground">
                    On by default. Browsers keep audio silent until you have clicked something on
                    the page, so the first sound only plays after a click.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={soundOn ? 'default' : 'outline'}
                        onClick={() => {
                            const next = !soundOn
                            setTxSoundEnabled(next)
                            setSoundOn(next)
                            if (next) playTxSound('step')
                        }}
                    >
                        Sound {soundOn ? 'on' : 'off'}
                    </Button>
                    {SOUNDS.map((s) => (
                        <Button key={s} variant="outline" onClick={() => playTxSound(s)}>
                            {s}
                        </Button>
                    ))}
                </div>
            </section>

            <section className="mt-10 grid gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Full flow</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3].map((n) => (
                        <Button
                            key={n}
                            variant={stepCount === n ? 'default' : 'outline'}
                            onClick={() => setStepCount(n)}
                        >
                            {n} step{n > 1 ? 's' : ''}
                        </Button>
                    ))}
                    <Button onClick={playFlow}>▶ Play</Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setLiveStep(stepCount - 1)
                            setLivePhase('sim-error')
                            setFlowOpen(true)
                        }}
                    >
                        Simulation failure
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setLiveStep(stepCount - 1)
                            setLivePhase('error')
                            setFlowOpen(true)
                        }}
                    >
                        On-chain revert
                    </Button>
                </div>
            </section>

            <section className="mt-10 grid gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Stages</h2>
                <div className="flex flex-wrap gap-2">
                    {PHASES.map((p) => (
                        <Button
                            key={p}
                            variant={phase === p ? 'default' : 'outline'}
                            // Remounting is what replays a one-shot animation like the success sheen.
                            onClick={() => (setPhase('idle'), setTimeout(() => setPhase(p), 20))}
                        >
                            {p}
                        </Button>
                    ))}
                </div>

                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    {Object.entries(SIDES).map(([name, sides]) => (
                        <Card key={name}>
                            <CardContent className="grid gap-2 p-4">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    flow · {name}
                                </span>
                                <TxStageFlow
                                    key={phase}
                                    phase={phase}
                                    chainId={CHAIN_ID}
                                    hash={phase === 'pending' ? undefined : HASH}
                                    from={sides.from}
                                    to={sides.to}
                                />
                            </CardContent>
                        </Card>
                    ))}
                    <Card>
                        <CardContent className="grid gap-2 p-4">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                record · Add liquidity
                            </span>
                            <TxStageRecord
                                key={phase}
                                phase={phase}
                                chainId={CHAIN_ID}
                                hash={phase === 'pending' ? undefined : HASH}
                                rows={RECORD_ROWS}
                            />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="mt-10 grid gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Reduced motion</h2>
                <p className={cn('max-w-[62ch] text-sm text-muted-foreground')}>
                    Turn on the OS setting and reload: every scene should freeze on a readable
                    resting frame, the sheen and sparks drop out, and all four sounds go silent.
                </p>
            </section>

            <TxFlowDialog
                open={flowOpen}
                onOpenChange={setFlowOpen}
                title="Add liquidity"
                steps={steps}
                chainId={CHAIN_ID}
            />
        </div>
    )
}
