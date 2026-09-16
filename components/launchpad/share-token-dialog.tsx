'use client'

import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/ui/token-icon'
import { formatCompact } from '@/services/launchpad/launchpad'
import { cn } from '@/lib/utils'
import { JUNOSWAP_X_HANDLE } from '@/lib/socials'
import { toastSuccess } from '@/lib/toast'
import { useShareableImage } from '@/hooks/useShareableImage'
import { useLaunchpadChainId } from '@/hooks/useLaunchpadChainId'
import { useNativeUsdPriceContext } from './native-usd-price-provider'
import { Check, Copy, ArrowRight, Download } from 'lucide-react'

interface ShareTokenDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tokenAddr: Address
    symbol: string
    name: string
    logo?: string
    marketCap: string
    priceChange1dPct?: number | null
    isGraduated?: boolean
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    )
}

function LogoMark({ size = 24 }: { size?: number }) {
    return (
        <div
            className="bg-gradient-to-br from-primary to-[#FF914D]"
            style={{
                width: size,
                height: size,
                WebkitMaskImage: 'url(/logo.svg)',
                maskImage: 'url(/logo.svg)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
            }}
        />
    )
}

// Meme-style "stonks" line scribbled across the token image on the share card -- decorative,
// not real price data (the dialog doesn't have chart history), so a fixed jagged path is enough.
// Direction/color follow priceChange1dPct so it still reads as "up" or "down" at a glance.
const CHART_OVERLAY_PATH_UP = 'M4,92 L20,78 L32,86 L46,58 L58,66 L72,32 L84,40 L100,12'
const CHART_OVERLAY_PATH_DOWN = 'M4,20 L20,34 L32,26 L46,54 L58,46 L72,80 L84,72 L100,100'

function ChartOverlay({ isUp }: { isUp: boolean }) {
    const color = isUp ? '#4ade80' : '#f87171'
    return (
        <svg
            viewBox="0 0 112 112"
            className="pointer-events-none absolute inset-1.5 h-28 w-28"
            aria-hidden="true"
        >
            <path
                d={isUp ? CHART_OVERLAY_PATH_UP : CHART_OVERLAY_PATH_DOWN}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
        </svg>
    )
}

export function ShareTokenDialog({
    open,
    onOpenChange,
    tokenAddr,
    symbol,
    name,
    logo,
    marketCap,
    priceChange1dPct,
    isGraduated,
}: ShareTokenDialogProps) {
    const [copied, setCopied] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const { downloadImage, isGenerating } = useShareableImage()
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
    const [logoReady, setLogoReady] = useState(!logo)
    useEffect(() => {
        if (!logo) {
            setLogoDataUrl(null)
            setLogoReady(true)
            return
        }
        let cancelled = false
        setLogoReady(false)
        fetch(logo)
            .then((res) => res.blob())
            .then(
                (blob) =>
                    new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    })
            )
            .then((dataUrl) => {
                if (!cancelled) setLogoDataUrl(dataUrl)
            })
            .catch(() => {
                // keep the remote URL for display; capture may omit the logo but won't crash
            })
            .finally(() => {
                if (!cancelled) setLogoReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [logo])

    const { nativeUsdPrice } = useNativeUsdPriceContext()
    const chainId = useLaunchpadChainId()

    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://junoswap.trade'}/launchpad/token/${tokenAddr}?chain=${chainId}`

    const mcapNum = parseFloat(marketCap)
    const mcapDisplay =
        mcapNum > 0
            ? nativeUsdPrice !== null
                ? `$${formatCompact(mcapNum * nativeUsdPrice)}`
                : `${formatCompact(mcapNum)} KUB`
            : null

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        toastSuccess('Link copied to clipboard!')
        setTimeout(() => setCopied(false), 2000)
    }

    const shareOnX = () => {
        const text = `$${symbol} on Junoswap Launchpad 🚀 via @${JUNOSWAP_X_HANDLE}`
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
        window.open(intentUrl, '_blank', 'noopener,noreferrer')
    }

    const saveImage = () => {
        if (!cardRef.current) return
        downloadImage(cardRef.current, `junoswap-${symbol.toLowerCase()}.png`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md gap-4 rounded-2xl p-4 sm:gap-5 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">Share coin</DialogTitle>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                        Copy link or share directly to X
                    </p>
                </DialogHeader>
                <div ref={cardRef} className="overflow-hidden rounded-xl bg-[#0a0e14]">
                    <div
                        className="relative overflow-hidden rounded-xl border border-white/10"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    >
                        <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -right-12 h-48 w-48 rounded-full bg-[#FF914D]/15 blur-3xl" />

                        <div className="relative flex flex-row items-start justify-between gap-4 p-5">
                            <div className="min-w-0 flex-1 text-left">
                                <div className="flex items-center justify-start gap-1.5">
                                    <LogoMark size={16} />
                                    <span className="bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-xs font-bold text-transparent">
                                        Junoswap
                                    </span>
                                </div>

                                <h3 className="mt-3 truncate text-3xl font-extrabold uppercase tracking-tight text-white">
                                    {symbol}
                                </h3>
                                <p className="mt-0.5 truncate text-sm text-white/55">{name}</p>

                                <div className="mt-2.5 flex flex-wrap items-center justify-start gap-2">
                                    {mcapDisplay && (
                                        <span className="text-sm font-semibold text-white">
                                            MC {mcapDisplay}
                                        </span>
                                    )}
                                    {priceChange1dPct != null && (
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                                                priceChange1dPct >= 0
                                                    ? 'bg-positive/15 text-positive'
                                                    : 'bg-negative/15 text-negative'
                                            )}
                                        >
                                            {priceChange1dPct >= 0 ? '+' : ''}
                                            {priceChange1dPct.toFixed(2)}%
                                        </span>
                                    )}
                                    {isGraduated && (
                                        <span className="inline-flex items-center rounded-md bg-positive/15 px-1.5 py-0.5 text-xs font-semibold text-positive">
                                            Graduated
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[#FF914D] px-4 py-1.5 text-xs font-bold tracking-wider text-white">
                                    BUY
                                    <ArrowRight className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="relative shrink-0 rounded-2xl border border-white/10 bg-white/5 p-1.5">
                                {logoDataUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- data URL captured by html-to-image; next/image would defeat the purpose
                                    <img
                                        src={logoDataUrl}
                                        alt={symbol}
                                        className="h-28 w-28 rounded-xl object-cover"
                                    />
                                ) : (
                                    <TokenIcon
                                        src={logo}
                                        symbol={symbol}
                                        size="xl"
                                        variant="square"
                                        className="h-28 w-28 rounded-xl"
                                    />
                                )}
                                <ChartOverlay
                                    isUp={priceChange1dPct == null || priceChange1dPct >= 0}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Button onClick={copyLink} className="h-11 w-full rounded-xl sm:h-12" size="lg">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy link'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={shareOnX}
                        className="h-11 w-full rounded-xl sm:h-12"
                        size="lg"
                    >
                        <XIcon className="h-4 w-4" />
                        Share on X
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={saveImage}
                        disabled={isGenerating || !logoReady}
                        className="h-11 w-full rounded-xl sm:h-12"
                        size="lg"
                    >
                        <Download className="h-4 w-4" />
                        Save image
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
