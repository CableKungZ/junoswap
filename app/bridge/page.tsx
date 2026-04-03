'use client'

import { Suspense } from 'react'
import { useChainId } from 'wagmi'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
                        <CardHeader>
                            <CardTitle>Chain Not Supported</CardTitle>
                            <CardDescription>
                                Bridge is not available on this chain. Please switch to a supported
                                chain like BNB Chain, Base, or Worldchain.
                            </CardDescription>
                        </CardHeader>
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
