'use client'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { chainMetadata, getChainMetadata } from '@/lib/wagmi'
import { BRIDGE_SUPPORTED_CHAIN_IDS } from '@/types/bridge'
import { cn } from '@/lib/utils'

interface ChainSelectProps {
    selectedChainId: number
    onSelect: (chainId: number) => void
    disabled?: boolean
    label?: string
}

export function ChainSelect({
    selectedChainId,
    onSelect,
    disabled = false,
    label = 'Select chain',
}: ChainSelectProps) {
    const selectedMeta = getChainMetadata(selectedChainId)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'min-w-36 justify-start px-3',
                        !selectedMeta && 'text-muted-foreground'
                    )}
                    disabled={disabled}
                >
                    {selectedMeta ? (
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={selectedMeta.icon}
                                alt={selectedMeta.name}
                                className={cn(
                                    'h-5 w-5 rounded-full object-cover',
                                    'invertInLight' in selectedMeta &&
                                        selectedMeta.invertInLight &&
                                        'invert dark:invert-0'
                                )}
                            />
                            <span className="font-medium">{selectedMeta.name}</span>
                        </div>
                    ) : (
                        label
                    )}
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {BRIDGE_SUPPORTED_CHAIN_IDS.map((chainId) => {
                    const meta = chainMetadata[chainId as keyof typeof chainMetadata]
                    if (!meta) return null
                    return (
                        <DropdownMenuItem
                            key={chainId}
                            onClick={() => onSelect(chainId)}
                            className={cn(
                                'cursor-pointer',
                                selectedChainId === chainId && 'bg-accent'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={meta.icon}
                                    alt={meta.name}
                                    className={cn(
                                        'h-5 w-5 rounded-full object-cover',
                                        'invertInLight' in meta &&
                                            meta.invertInLight &&
                                            'invert dark:invert-0'
                                    )}
                                />
                                <span>{meta.name}</span>
                            </div>
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
