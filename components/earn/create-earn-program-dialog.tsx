'use client'

import { useChainId } from 'wagmi'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { getStakerAddress, getStakingRewards, type EarnProgram } from '@/lib/earn-programs'

const PROGRAM_OPTIONS: {
    id: EarnProgram | 'v2'
    title: string
    description: string
    kind: string
}[] = [
    {
        id: 'v3',
        title: 'v3Staker',
        description: 'Reward concentrated-liquidity LPs across a whole v3 pool.',
        kind: 'LP farming',
    },
    {
        id: 'juno-v3',
        title: 'Juno-v3Staker',
        description: 'Same, but the budget is split between the staked positions only.',
        kind: 'LP farming',
    },
    {
        id: 'v2',
        title: 'v2Staker',
        description: 'Single-token staking — stake one token, earn another, optional lock.',
        kind: 'Token staking',
    },
]

export function CreateEarnProgramDialog({
    open,
    onClose,
    onSelect,
}: {
    open: boolean
    onClose: () => void
    onSelect: (id: EarnProgram | 'v2') => void
}) {
    const chainId = useChainId()
    // Only what is deployed here: a program with no contract on this chain is not offered at all.
    const options = PROGRAM_OPTIONS.filter((option) =>
        option.id === 'v2' ? !!getStakingRewards(chainId) : !!getStakerAddress(chainId, option.id)
    )

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-md border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-lg">Create Earn Program</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    {options.length === 0 && (
                        <EmptyState
                            title="Not available"
                            description="No earn program is deployed on this chain yet."
                        />
                    )}
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.id)}
                            className="w-full rounded-2xl border border-border/50 bg-muted/20 p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{option.title}</span>
                                <Badge variant="outline">{option.kind}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {option.description}
                            </p>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
