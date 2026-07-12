export function hasSettled(enabled: boolean, data: unknown): boolean {
    return !enabled || data !== undefined
}
