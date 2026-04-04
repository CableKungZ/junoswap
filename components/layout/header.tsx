'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@/components/web3/connect-button'
import { NetworkSwitcher } from '@/components/web3/network-switcher'
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/ui/navigation-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { useState } from 'react'

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const navLinks = [
        { href: '/swap', label: 'Swap' },
        { href: '/earn', label: 'Earn' },
        { href: '/bridge', label: 'Bridge' },
        { href: '/launchpad', label: 'Launchpad' },
        { href: '/points', label: 'Points' },
    ]
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 justify-between items-center px-6">
                <div className="flex items-center w-[180px]">
                    <Link href="/" className="flex items-center space-x-2">
                        <Image src="/favicon.ico" alt="cmswap" width={32} height={32} />
                        <span className="hidden md:inline text-xl font-bold">CMswap</span>
                    </Link>
                </div>
                <NavigationMenu className="hidden md:flex flex-1 justify-center">
                    <NavigationMenuList>
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href
                            return (
                                <NavigationMenuItem key={link.href}>
                                    <NavigationMenuLink asChild>
                                        <Link
                                            href={link.href}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'border-b-2 border-white'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {link.label}
                                        </Link>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            )
                        })}
                    </NavigationMenuList>
                </NavigationMenu>
                <div className="flex items-center gap-2">
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="bg-background/95 backdrop-blur">
                            <nav className="flex flex-col gap-4 mt-8">
                                {navLinks.map((link) => {
                                    const isActive = pathname === link.href
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`text-lg font-medium transition-colors border-b-2 pb-1 ${
                                                isActive
                                                    ? 'text-primary border-primary'
                                                    : 'text-foreground hover:text-primary border-transparent'
                                            }`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </SheetContent>
                    </Sheet>
                    <NetworkSwitcher />
                    <ConnectButton />
                </div>
            </div>
        </header>
    )
}
