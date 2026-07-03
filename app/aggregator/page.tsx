'use client'

import { Suspense } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { bitkub } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { AggregatorCard } from '@/components/aggregator/aggregator-card'
import { AggregatorSettingsCard } from '@/components/aggregator/aggregator-settings-card'
import { AGGREGATOR_SUPPORTED_CHAIN_IDS } from '@/lib/aggregator-config'

export default function AggregatorPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">Loading...</div>
            }
        >
            <AggregatorContent />
        </Suspense>
    )
}

function AggregatorContent() {
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    const isCorrectChain = AGGREGATOR_SUPPORTED_CHAIN_IDS.includes(chainId)
    if (!isCorrectChain) {
        return (
            <div className="flex min-h-screen items-start justify-center">
                <div className="text-center">
                    <h1 className="mb-4 text-2xl font-bold">Wrong Network</h1>
                    <p className="mb-4 text-muted-foreground">
                        The Swap Aggregator is currently available on KUB Chain only
                    </p>
                    <Button onClick={() => switchChain({ chainId: bitkub.id })}>
                        Switch to KUB Chain
                    </Button>
                </div>
            </div>
        )
    }
    return (
        <div className="flex min-h-screen items-start justify-center p-4">
            <div className="w-full max-w-md space-y-4">
                <AggregatorCard />
                <AggregatorSettingsCard />
            </div>
        </div>
    )
}
