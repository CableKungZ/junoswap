'use client'

import { Suspense } from 'react'
import { useChainId } from 'wagmi'
import { Unplug } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { BridgeCard } from '@/components/bridge/bridge-card'
import { BRIDGE_SUPPORTED_CHAIN_IDS } from '@/types/bridge'

function BridgeContent() {
    const chainId = useChainId()
    const isSupported = BRIDGE_SUPPORTED_CHAIN_IDS.includes(
        chainId as (typeof BRIDGE_SUPPORTED_CHAIN_IDS)[number]
    )

    if (!isSupported) {
        return (
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <Card>
                        <CardContent className="py-12">
                            <EmptyState
                                icon={Unplug}
                                title="Chain Not Supported"
                                description="Bridge is not available on this chain. Please switch to a supported chain like BNB Chain, Base, or Worldchain."
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-start justify-center p-4">
            <div className="w-full max-w-md space-y-4">
                <BridgeCard />
            </div>
        </div>
    )
}

export default function BridgePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">Loading...</div>
            }
        >
            <BridgeContent />
        </Suspense>
    )
}
