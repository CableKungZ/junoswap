'use client'

import { useConnect } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Wallet, Loader2 } from 'lucide-react'
import { toastError } from '@/lib/toast'
import { KUB_WALLET_ID } from '@/lib/wagmi'
import type { ConnectModalProps } from '@/types/web3'

const WALLET_NAMES: Record<string, string> = {
    injected: 'Browser Wallet',
    walletConnect: 'Wallet Connect',
    coinbaseWallet: 'Coinbase Wallet',
}

const WALLET_DESCRIPTIONS: Record<string, string> = {
    injected: 'Browser wallet',
    walletConnect: 'Scan with mobile wallet',
    coinbaseWallet: 'Coinbase Wallet',
}

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
    const { connectAsync, connectors, isPending } = useConnect()
    const handleConnect = async (connectorId: string) => {
        const connector = connectors.find((c) => c.id === connectorId)
        if (!connector) return
        try {
            await connectAsync({ connector })
            onOpenChange(false)
        } catch (error: unknown) {
            const isUserRejection =
                typeof error === 'object' &&
                error !== null &&
                (('code' in error && error.code === 4001) ||
                    ('message' in error &&
                        typeof error.message === 'string' &&
                        error.message.includes('User rejected')))
            if (isUserRejection) {
                toastError('Connection rejected by user')
            } else {
                toastError('Failed to connect wallet')
            }
        }
    }
    const handleKubWallet = async () => {
        const { ApiController, CoreHelperUtil, ModalController, RouterController } =
            await import('@reown/appkit-controllers')
        const isMobile = CoreHelperUtil.isMobile
        const cleanup = () => {
            CoreHelperUtil.isMobile = isMobile
            unsubscribe()
        }
        // WalletConnect's modal always opens on its generic view; hop to KUB Wallet's own view once it's open
        const unsubscribe = ModalController.subscribeKey('open', async (isOpen) => {
            if (!isOpen) return cleanup()
            const findKub = () => ApiController.state.featured.find((w) => w.id === KUB_WALLET_ID)
            // The WalletConnect modal opens without waiting for its featured-wallet fetch, so it's empty on first open
            if (!findKub()) await ApiController.fetchFeaturedWallets()
            const wallet = findKub()
            if (!wallet || !ModalController.state.open) return
            // ponytail: AppKit swaps the QR for a deep-link screen on mobile and has no option to
            // stop it, so pretend desktop while this modal is open. Re-check if appkit is upgraded.
            CoreHelperUtil.isMobile = () => false
            RouterController.push('ConnectingWalletConnect', { wallet })
        })
        // Close our dialog first so its focus trap doesn't block the WalletConnect modal
        onOpenChange(false)
        await handleConnect('walletConnect')
        cleanup()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50"
                aria-describedby="wallet-connect-description"
            >
                <DialogHeader>
                    <DialogTitle className="text-lg">Connect Wallet</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Button
                        variant="outline"
                        className="w-full justify-start h-12 px-3 hover:bg-muted/50 hover:border-border"
                        onClick={handleKubWallet}
                        disabled={isPending}
                        aria-label="Connect with KUB Wallet"
                    >
                        <Wallet className="mr-3 h-4 w-4" aria-hidden="true" />
                        <div className="flex flex-col items-start">
                            <span className="font-medium">KUB Wallet</span>
                            <span className="text-xs text-muted-foreground">
                                Scan with KUB Wallet
                            </span>
                        </div>
                    </Button>
                    {connectors
                        .filter((connector) => connector.id !== 'injected')
                        .map((connector) => (
                            <Button
                                key={connector.id}
                                variant="outline"
                                className="w-full justify-start h-12 px-3 hover:bg-muted/50 hover:border-border"
                                onClick={() => handleConnect(connector.id)}
                                disabled={isPending}
                                aria-label={`Connect with ${WALLET_NAMES[connector.id] || connector.name}`}
                            >
                                {isPending ? (
                                    <Loader2
                                        className="mr-3 h-4 w-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Wallet className="mr-3 h-4 w-4" aria-hidden="true" />
                                )}
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">
                                        {WALLET_NAMES[connector.id] || connector.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {WALLET_DESCRIPTIONS[connector.type] || connector.type}
                                    </span>
                                </div>
                            </Button>
                        ))}
                </div>
                <p className="text-center text-xs text-muted-foreground/70 pb-1">
                    By connecting, you agree to our Terms of Service
                </p>
            </DialogContent>
        </Dialog>
    )
}
