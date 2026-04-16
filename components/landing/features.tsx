import { Repeat, GitBranch, Rocket } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const features = [
    {
        name: 'Aggregate Swap',
        description:
            'Compare prices across multiple DEXs and automatically get the best rate. Save on every trade with smart routing.',
        icon: Repeat,
        href: '/swap',
    },
    {
        name: 'Cross-Chain Bridge',
        description:
            'Move tokens seamlessly across multiple chains. Fast, secure, and low-cost cross-chain transfers.',
        icon: GitBranch,
        href: '/bridge',
    },
    {
        name: 'Memecoin Launchpad',
        description:
            'Launch your own token in minutes. Create, deploy, and add liquidity - all from one simple interface.',
        icon: Rocket,
        href: '/launchpad',
    },
]

export function Features() {
    return (
        <section className="py-20 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-primary">Features</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                        Everything you need to trade
                    </p>
                </div>
                <div className="mx-auto mt-16 grid max-w-xl grid-cols-1 gap-8 sm:mt-20 lg:max-w-none lg:grid-cols-3">
                    {features.map((feature) => {
                        const Icon = feature.icon
                        return (
                            <Card key={feature.name} className="group transition-all">
                                <CardHeader>
                                    <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 w-fit">
                                        <Icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle>{feature.name}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
