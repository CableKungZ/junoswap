'use client'

import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { parseEther } from 'viem'
import { ERC20_ABI } from '@/lib/abis/erc20'
import { PUMP_CORE_NATIVE_CHAIN_ID } from '@/lib/abis/pump-core-native'
import { useTokenReserves } from '@/hooks/useTokenReserves'
import { useTokenList } from '@/hooks/useTokenList'
import { calculateMarketCap, formatKub, formatTokenAmount } from '@/services/launchpad'
import { formatAddress } from '@/lib/utils'
import { GraduationProgress } from './graduation-progress'
import { TokenTradeCard } from './token-trade-card'
import { Loader2, Globe, Twitter, MessageCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TokenDetailPageProps {
    tokenAddr: Address
}

export function TokenDetailPage({ tokenAddr }: TokenDetailPageProps) {
    // Read ERC20 metadata
    const { data: tokenName } = useReadContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'name',
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    const { data: tokenSymbol } = useReadContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'symbol',
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    const { data: tokenDecimals } = useReadContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId: PUMP_CORE_NATIVE_CHAIN_ID,
    })

    // Read reserves
    const {
        nativeReserve,
        tokenReserve,
        isGraduated,
        graduationAmount,
        isLoading: isLoadingReserves,
    } = useTokenReserves({ tokenAddr })

    // Get creation event data for this token
    const { tokens: allTokens } = useTokenList()
    const tokenInfo = allTokens.find((t) => t.address.toLowerCase() === tokenAddr.toLowerCase())

    const totalSupply = parseEther('1000000000') // 1 billion with 18 decimals
    const marketCap = calculateMarketCap(nativeReserve, tokenReserve, totalSupply)

    const symbol = (tokenSymbol as string) || 'TOKEN'
    const name = (tokenName as string) || 'Unknown Token'
    const decimals = (tokenDecimals as number) || 18

    if (isLoadingReserves) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            {/* Back button */}
            <Link
                href="/launchpad"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Launchpad
            </Link>

            {/* Token header */}
            <div className="flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                    {tokenInfo?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={tokenInfo.logo}
                            alt={symbol}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                            {symbol.slice(0, 2)}
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold">{name}</h1>
                    <p className="text-sm text-muted-foreground">${symbol}</p>
                    {tokenInfo && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            Created by {formatAddress(tokenInfo.creator)}
                        </p>
                    )}
                </div>
            </div>

            {/* Description */}
            {tokenInfo?.description && (
                <p className="text-sm text-muted-foreground">{tokenInfo.description}</p>
            )}

            {/* Social links */}
            {(tokenInfo?.link1 || tokenInfo?.link2 || tokenInfo?.link3) && (
                <div className="flex gap-3">
                    {tokenInfo?.link1 && (
                        <a
                            href={tokenInfo.link1}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Globe className="h-4 w-4" />
                        </a>
                    )}
                    {tokenInfo?.link2 && (
                        <a
                            href={tokenInfo.link2}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Twitter className="h-4 w-4" />
                        </a>
                    )}
                    {tokenInfo?.link3 && (
                        <a
                            href={tokenInfo.link3}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <MessageCircle className="h-4 w-4" />
                        </a>
                    )}
                </div>
            )}

            {/* Market info */}
            <div className="rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Market Cap</p>
                        <p className="font-semibold">{marketCap} KUB</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">KUB Reserve</p>
                        <p className="font-semibold">{formatKub(nativeReserve)} KUB</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Token Reserve</p>
                        <p className="font-semibold">
                            {formatTokenAmount(tokenReserve)} {symbol}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-semibold">
                            {isGraduated ? 'Graduated' : 'Bonding Curve'}
                        </p>
                    </div>
                </div>

                {/* Graduation progress */}
                {!isGraduated && graduationAmount > 0n && (
                    <div className="mt-4">
                        <GraduationProgress
                            nativeReserve={nativeReserve}
                            graduationAmount={graduationAmount}
                            isGraduated={isGraduated}
                        />
                    </div>
                )}
            </div>

            {/* Trading interface */}
            <TokenTradeCard
                tokenAddr={tokenAddr}
                tokenSymbol={symbol}
                tokenDecimals={decimals}
                isGraduated={isGraduated}
            />
        </div>
    )
}
