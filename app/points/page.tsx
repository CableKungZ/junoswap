'use client'

import { Suspense } from 'react'
import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
                    <Card>
                        <CardContent className="py-12">
                            <EmptyState
                                icon={Trophy}
                                title="Points"
                                description="Earn points, complete quests, and climb the leaderboard. Coming soon in Phase 6."
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Suspense>
    )
}
