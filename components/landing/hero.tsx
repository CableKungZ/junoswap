import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Shield, TrendingUp } from 'lucide-react'

export function Hero() {
    return (
        <section className="relative overflow-hidden py-20 sm:py-32">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_60%,hsl(0_100%_60%_/_0.08),hsl(23_100%_65%_/_0.06),transparent)]"></div>
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                        Trade, Launch & Win
                        <span className="bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-transparent">
                            {' '}
                            Everything
                        </span>
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
                        Best rates. Any chain. One platform.
                    </p>
                    <div className="mt-10">
                        <Link href="/swap">
                            <Button size="xl" className="group w-full sm:w-auto">
                                Start Swapping
                            </Button>
                        </Link>
                    </div>
                    <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <span>Audited & Secure</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <span>Best Rates Guaranteed</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
