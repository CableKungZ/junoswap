'use client'

import { Suspense } from 'react'
import { Rocket } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export default function LaunchpadPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">Loading...</div>
            }
        >
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <Card>
                        <CardContent className="py-12">
                            <EmptyState
                                icon={Rocket}
                                title="Launchpad"
                                description="Create and launch your own tokens. Coming soon in Phase 5."
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Suspense>
    )
}
