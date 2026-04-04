import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getInitials(address: string): string {
    return address.slice(2, 4).toUpperCase()
}

export function formatAddress(address: string, startChars = 6, endChars = 4): string {
    if (!address || address.length < 10) return address
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Validates numeric input for token amounts
 * Allows: digits, one decimal point, leading/trailing decimal
 * Blocks: multiple decimals, leading zeros (05), scientific notation (e5)
 */
export function isValidNumberInput(value: string): boolean {
    // Allow empty string
    if (value === '') return true
    // Only allow digits and one decimal point
    if (!/^\d*\.?\d*$/.test(value)) return false
    // Don't allow multiple decimal points
    if ((value.match(/\./g) || []).length > 1) return false
    // Don't allow leading zeros followed by digits (e.g., "05" → "0.5" is ok, but "05" is not)
    if (/^0\d+$/.test(value)) return false
    return true
}
