'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useLaunchpadStore } from '@/store/launchpad-store'
import { useCreateToken } from '@/hooks/useCreateToken'
import { PUMP_CORE_NATIVE_ADDRESS, PUMP_CORE_NATIVE_CHAIN_ID } from '@/lib/abis/pump-core-native'
import { toastError, toastSuccess } from '@/lib/toast'
import { getChainMetadata } from '@/lib/wagmi'
import type { CreateTokenForm } from '@/types/launchpad'
import { Globe, Twitter, MessageCircle, ImageIcon, Coins, Loader2 } from 'lucide-react'

export function CreateTokenDialog() {
    const router = useRouter()
    const { isConnected } = useAccount()
    const publicClient = usePublicClient({ chainId: PUMP_CORE_NATIVE_CHAIN_ID })
    const { isCreateDialogOpen, setIsCreateDialogOpen } = useLaunchpadStore()

    const [form, setForm] = useState<CreateTokenForm>({
        name: '',
        symbol: '',
        logo: '',
        description: '',
        link1: '',
        link2: '',
        link3: '',
    })

    const { create, isExecuting, isConfirming, isSuccess, isError, error, hash } = useCreateToken({
        form: form.name && form.symbol ? form : null,
    })

    // Reset form when dialog opens
    useEffect(() => {
        if (isCreateDialogOpen) {
            setForm({
                name: '',
                symbol: '',
                logo: '',
                description: '',
                link1: '',
                link2: '',
                link3: '',
            })
        }
    }, [isCreateDialogOpen])

    // Handle success - navigate to token page
    const handleSuccess = useCallback(async () => {
        if (!hash) return

        const metadata = getChainMetadata(PUMP_CORE_NATIVE_CHAIN_ID)
        toastSuccess('Token created!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(`${metadata.explorer}/tx/${hash}`, '_blank'),
            },
        })

        if (publicClient) {
            try {
                const receipt = await publicClient.getTransactionReceipt({ hash })
                for (const log of receipt.logs) {
                    if (log.address.toLowerCase() === PUMP_CORE_NATIVE_ADDRESS.toLowerCase()) {
                        const tokenAddr = `0x${log.topics[1]?.slice(26)}` as `0x${string}`
                        if (tokenAddr && tokenAddr.length === 42) {
                            setIsCreateDialogOpen(false)
                            router.push(`/launchpad/token/${tokenAddr}`)
                            return
                        }
                    }
                }
            } catch {
                // If parsing fails, fall through to close
            }
        }
        setIsCreateDialogOpen(false)
    }, [hash, publicClient, router, setIsCreateDialogOpen])

    useEffect(() => {
        if (isSuccess) handleSuccess()
    }, [isSuccess, handleSuccess])

    // Handle error
    useEffect(() => {
        if (isError && error) {
            toastError(error, 'Token creation failed')
        }
    }, [isError, error])

    const updateField = (field: keyof CreateTokenForm, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (!form.name.trim() || !form.symbol.trim()) return 'Enter Name & Symbol'
        if (isExecuting) return 'Creating...'
        if (isConfirming) return 'Confirming...'
        return 'Create Token'
    }

    const isButtonDisabled =
        !isConnected || !form.name.trim() || !form.symbol.trim() || isExecuting || isConfirming

    return (
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Coins className="h-5 w-5 text-primary" />
                        Create Token
                    </DialogTitle>
                    <DialogDescription>
                        Launch your own token on the bonding curve.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Token Identity */}
                    <div>
                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                            Token Identity
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="token-name">Name *</Label>
                                <Input
                                    id="token-name"
                                    placeholder="e.g. My Token"
                                    value={form.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="token-symbol">Symbol *</Label>
                                <Input
                                    id="token-symbol"
                                    placeholder="e.g. MTK"
                                    value={form.symbol}
                                    onChange={(e) =>
                                        updateField('symbol', e.target.value.toUpperCase())
                                    }
                                    maxLength={10}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Logo & Description */}
                    <div>
                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Details</h3>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="token-logo" className="flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Logo URL
                                </Label>
                                <Input
                                    id="token-logo"
                                    placeholder="https://..."
                                    value={form.logo}
                                    onChange={(e) => updateField('logo', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="token-description">Description</Label>
                                <Input
                                    id="token-description"
                                    placeholder="Describe your token..."
                                    value={form.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div>
                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                            Social Links
                        </h3>
                        <div className="space-y-2">
                            <div className="relative">
                                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Website URL"
                                    value={form.link1}
                                    onChange={(e) => updateField('link1', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="relative">
                                <Twitter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Twitter / X URL"
                                    value={form.link2}
                                    onChange={(e) => updateField('link2', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="relative">
                                <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Telegram URL"
                                    value={form.link3}
                                    onChange={(e) => updateField('link3', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Fee & Submit */}
                    <div className="rounded-lg border bg-card">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                Creation Fee
                            </span>
                            <span className="text-sm font-bold">0.1 KUB</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                Network
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                                KUB Testnet
                            </span>
                        </div>
                    </div>

                    <Button className="w-full" onClick={create} disabled={isButtonDisabled}>
                        {(isExecuting || isConfirming) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {getButtonText()}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
