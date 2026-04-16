'use client'

import { Suspense } from 'react'
import { Trophy } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function PointsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">Loading...</div>
            }
        >
            <div className="flex min-h-screen items-start justify-center p-4">
                <div className="w-full max-w-md space-y-4">
                    <EmptyState
                        icon={Trophy}
                        title="Points"
                        description="Earn points, complete quests, and climb the leaderboard. Coming soon."
                    />
                </div>
            </div>
        </Suspense>
    )
}
