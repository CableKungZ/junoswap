'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@/components/web3/connect-button'
import { NetworkSwitcher } from '@/components/web3/network-switcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'
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
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center px-4 lg:px-6">
                {/* Left group: Hamburger (mobile) + Logo + Desktop Nav */}
                <div className="flex items-center gap-1 md:gap-6 lg:gap-8">
                    {/* Mobile hamburger - left of logo */}
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden -ml-2 mr-1">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="left"
                            className="bg-background/95 backdrop-blur w-[280px] sm:w-[320px]"
                        >
                            {/* Drawer header */}
                            <div className="flex items-center space-x-2 mt-2 mb-6">
                                <Image
                                    src="/logo.svg"
                                    alt="junoswap"
                                    width={24}
                                    height={24}
                                    className="theme-logo"
                                />
                                <span className="text-lg font-bold">Junoswap</span>
                            </div>

                            {/* Nav links */}
                            <nav className="flex flex-col gap-1">
                                {navLinks.map((link) => {
                                    const isActive = pathname === link.href
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`flex items-center min-h-[48px] px-4 py-3 text-[15px] font-medium transition-all duration-150 ${
                                                isActive
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground border-transparent'
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

                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <Image
                            src="/logo.svg"
                            alt="junoswap"
                            width={28}
                            height={28}
                            className="theme-logo"
                        />
                        <span className="hidden md:inline text-xl font-bold">Junoswap</span>
                    </Link>

                    {/* Desktop navigation */}
                    <NavigationMenu className="hidden md:flex">
                        <NavigationMenuList className="!justify-start gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href
                                return (
                                    <NavigationMenuItem key={link.href}>
                                        <NavigationMenuLink asChild>
                                            <Link
                                                href={link.href}
                                                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-out ${
                                                    isActive
                                                        ? 'text-foreground'
                                                        : 'text-muted-foreground'
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
                </div>

                <div className="flex-1" />

                {/* Right controls */}
                <div className="flex items-center gap-2">
                    <NetworkSwitcher />
                    <ThemeToggle />
                    <ConnectButton />
                </div>
            </div>
        </header>
    )
}
