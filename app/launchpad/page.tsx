'use client'

import { Suspense, useState } from 'react'
import { useChainId } from 'wagmi'
import { kubTestnet } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { TokenList } from '@/components/launchpad/token-list'
import { CreateTokenDialog } from '@/components/launchpad/create-token-dialog'
import { useLaunchpadStore } from '@/store/launchpad-store'
import { Plus, Search, Unplug } from 'lucide-react'

export default function LaunchpadPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">Loading...</div>
            }
        >
            <LaunchpadContent />
        </Suspense>
    )
}

function LaunchpadContent() {
    const chainId = useChainId()
    const { setIsCreateDialogOpen } = useLaunchpadStore()
    const [searchQuery, setSearchQuery] = useState('')

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

    return (
        <div className="mx-auto max-w-6xl px-4 py-6">
            {/* Toolbar */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, symbol, or address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create Token
                </Button>
            </div>

            {/* Token list */}
            <TokenList searchQuery={searchQuery} />

            {/* Create token dialog */}
            <CreateTokenDialog />
        </div>
    )
}
