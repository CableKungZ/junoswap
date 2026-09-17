'use client'

import type { Address } from 'viem'
import { useDurianfunCurveProgress } from '@/hooks/useDurianfunCurveProgress'
import { formatKub, formatKubRounded } from '@/services/launchpad/launchpad'
import { Card, CardContent } from '@/components/ui/card'

export function DurianfunGraduationProgress({
    marketAddr,
    chainId,
    isGraduated,
}: {
    marketAddr: Address
    chainId: number
    isGraduated: boolean
}) {
    const curve = useDurianfunCurveProgress(marketAddr, chainId)

    if (isGraduated) {
        return (
            <Card>
                <CardContent className="p-4">
                    <h4 className="mb-2 text-sm font-semibold">Bonding Curve</h4>
                    <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                                className="h-full w-full rounded-full"
                                style={{
                                    background:
                                        'linear-gradient(90deg, rgb(30 215 96 / 0.3), rgb(30 215 96))',
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-positive font-medium">Graduated</span>
                            {curve && (
                                <span className="text-muted-foreground">
                                    {formatKubRounded(curve.graduationKub)} KUB
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!curve) return null

    return (
        <Card>
            <CardContent className="p-4">
                <h4 className="mb-2 text-sm font-semibold">Bonding Curve</h4>
                <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                width: `${Math.min(curve.progress, 100)}%`,
                                background: `linear-gradient(90deg, hsl(var(--primary) / 0.3), hsl(var(--primary)))`,
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                            {formatKub(curve.kubRaised)} / {formatKubRounded(curve.graduationKub)}{' '}
                            KUB
                        </span>
                        <span>{curve.progress.toFixed(1)}%</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
