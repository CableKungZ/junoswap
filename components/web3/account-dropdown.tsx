'use client'

import { useDisconnect, useAccount, useBalance } from 'wagmi'
import { useChainId } from 'wagmi'
import { getChainMetadata } from '@/lib/wagmi'
import { formatAddress, getInitials } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Copy, ExternalLink, LogOut } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { Separator } from '@/components/ui/separator'

export function AccountDropdown({ children }: { children: React.ReactNode }) {
    const { disconnect } = useDisconnect()
    const { address } = useAccount()
    const chainId = useChainId()
    const { data: balance } = useBalance({
        address: address as `0x${string}`,
        query: {
            enabled: !!address,
        },
    })
    const chainMeta = getChainMetadata(chainId)
    const handleCopyAddress = async () => {
        if (address) {
            try {
                await navigator.clipboard.writeText(address)
                toastSuccess('Address copied')
            } catch {
                toastError('Failed to copy address')
            }
        }
    }
    const handleViewOnExplorer = () => {
        if (address) {
            const explorerUrl = `${chainMeta?.explorer || 'https://etherscan.io'}/address/${address}`
            window.open(explorerUrl, '_blank', 'noopener,noreferrer')
        }
    }
    const handleDisconnect = () => {
        disconnect()
        toastSuccess('Wallet disconnected')
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-64 bg-card/95 backdrop-blur-md border-border/50"
            >
                <div className="flex items-center gap-2.5 px-3 py-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-mono">
                            {address ? getInitials(address) : '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium truncate">
                            {address ? formatAddress(address) : 'Not connected'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {balance
                                ? `${Number(balance.formatted).toFixed(3)} ${balance.symbol}`
                                : '0.000 ETH'}
                        </div>
                    </div>
                </div>
                <Separator />
                <div className="p-2">
                    <DropdownMenuItem
                        onClick={handleCopyAddress}
                        className="flex items-center gap-3 cursor-pointer"
                        aria-label="Copy wallet address"
                    >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        <span>Copy address</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={handleViewOnExplorer}
                        className="flex items-center gap-3 cursor-pointer"
                        aria-label="View on block explorer"
                    >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span>View on explorer</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleDisconnect}
                        className="flex items-center gap-3 cursor-pointer text-destructive focus:text-destructive"
                        aria-label="Disconnect wallet"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        <span>Disconnect</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
