'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { useChainId } from 'wagmi'
import { isAddress } from 'viem'
import { kubTestnet } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TokenDetailPage } from '@/components/launchpad/token-detail-page'
import { Unplug, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function TokenPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">Loading...</div>
            }
        >
            <TokenPageContent />
        </Suspense>
    )
}

function TokenPageContent() {
    const params = useParams()
    const chainId = useChainId()
    const tokenAddr = params.address as string

    if (chainId !== kubTestnet.id) {
        return (
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <EmptyState
                        icon={Unplug}
                        title="Chain Not Supported"
                        description="Launchpad is currently available on KUB Testnet only. Please switch your network."
                    />
                </div>
            </div>
        )
    }

    if (!tokenAddr || !isAddress(tokenAddr)) {
        return (
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Invalid Token"
                        description="The token address in the URL is not valid."
                        action={
                            <Button asChild>
                                <Link href="/launchpad">Back to Launchpad</Link>
                            </Button>
                        }
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <TokenDetailPage tokenAddr={tokenAddr as `0x${string}`} />
        </div>
    )
}
