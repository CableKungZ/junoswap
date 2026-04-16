import Image from 'next/image'

const liveChains = [
    { name: 'KUB Chain', icon: '/chains/kubchain.png' },
    { name: 'JB Chain', icon: '/chains/jbchain.png' },
    { name: 'Worldchain', icon: '/chains/worldchain.svg' },
    { name: 'Base', icon: '/chains/base.svg' },
    { name: 'BNB Chain', icon: '/chains/bnbchain.svg' },
]

export function Chains() {
    return (
        <section className="bg-gray-900/30 py-16">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center text-2xl font-bold sm:text-3xl">
                    Multi-Chain Support
                </div>
                <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-5">
                    {liveChains.map((chain) => (
                        <div key={chain.name} className="flex flex-col items-center gap-6">
                            <div className="h-12 w-12 flex items-center justify-center shadow-lg">
                                <Image
                                    src={chain.icon}
                                    alt={chain.name}
                                    width={128}
                                    height={128}
                                    className="grayscale"
                                />
                            </div>
                            <span className="text-xs text-gray-300">{chain.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
