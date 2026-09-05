'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const CELLS = 42

function pad(value: number): string {
    return String(value).padStart(2, '0')
}

/** The `datetime-local` wire format, kept so callers can swap this in without touching their state. */
export function toLocalValue(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`
}

export function fromLocalValue(value: string): Date | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

/** The 42 cells a month grid needs, starting on the Sunday on or before the 1st. */
function monthGrid(month: Date): Date[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    return Array.from({ length: CELLS }, (_, index) => {
        const day = new Date(start)
        day.setDate(start.getDate() + index)
        return day
    })
}

function formatDisplay(date: Date): string {
    return date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * A calendar + clock in the app's own dialog, replacing the browser's `datetime-local` control so
 * the picker looks the same on every platform. The value stays in `datetime-local` format.
 */
export function DateTimePicker({
    value,
    onChange,
    disabled,
    placeholder = 'Pick a date and time',
    min,
    max,
    title = 'Pick a date and time',
}: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
    min?: Date
    max?: Date
    title?: string
}) {
    const [open, setOpen] = useState(false)
    const selected = useMemo(() => fromLocalValue(value), [value])

    const [draft, setDraft] = useState<Date>(() => selected ?? new Date())
    const [month, setMonth] = useState<Date>(() =>
        startOfDay(
            new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1)
        )
    )

    // Reopening always starts from what the field currently holds, never from a stale draft.
    useEffect(() => {
        if (!open) return
        const base = selected ?? new Date()
        setDraft(base)
        setMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }, [open, selected])

    const days = useMemo(() => monthGrid(month), [month])
    const today = startOfDay(new Date())

    const outOfBounds = (date: Date) => {
        if (min && date < startOfDay(min)) return true
        if (max && date > max) return true
        return false
    }

    const setDatePart = (date: Date) => {
        const next = new Date(date)
        next.setHours(draft.getHours(), draft.getMinutes(), 0, 0)
        setDraft(next)
    }

    const setTimePart = (hours: number, minutes: number) => {
        const next = new Date(draft)
        next.setHours(hours, minutes, 0, 0)
        setDraft(next)
    }

    const shift = (ms: number) => {
        const next = new Date(Date.now() + ms)
        next.setSeconds(0, 0)
        setDraft(next)
        setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    }

    const confirm = () => {
        onChange(toLocalValue(draft))
        setOpen(false)
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => setOpen(true)}
                className={cn(
                    'h-10 w-full justify-start gap-2 rounded-xl border-border/70 bg-background/40 px-3 font-normal',
                    !selected && 'text-muted-foreground'
                )}
            >
                <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
                <span className="truncate">{selected ? formatDisplay(selected) : placeholder}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-sm border-border/50 bg-card/95 backdrop-blur-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg">{title}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Previous month"
                                onClick={() =>
                                    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                                }
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-semibold">
                                {month.toLocaleString(undefined, {
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Next month"
                                onClick={() =>
                                    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                                }
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                            {WEEKDAYS.map((day) => (
                                <div
                                    key={day}
                                    className="py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                                >
                                    {day}
                                </div>
                            ))}
                            {days.map((day) => {
                                const isCurrentMonth = day.getMonth() === month.getMonth()
                                const isSelected = sameDay(day, draft)
                                const isToday = sameDay(day, today)
                                const isDisabled = outOfBounds(day)
                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        disabled={isDisabled}
                                        onClick={() => setDatePart(day)}
                                        className={cn(
                                            'aspect-square rounded-lg text-xs tabular-nums transition-colors',
                                            isCurrentMonth
                                                ? 'text-foreground'
                                                : 'text-muted-foreground/40',
                                            !isSelected && !isDisabled && 'hover:bg-muted/60',
                                            isToday && !isSelected && 'ring-1 ring-border',
                                            isSelected &&
                                                'bg-primary font-semibold text-primary-foreground',
                                            isDisabled && 'cursor-not-allowed opacity-30'
                                        )}
                                    >
                                        {day.getDate()}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                Time
                            </span>
                            <div className="ml-auto flex items-center gap-1">
                                <TimePart
                                    value={draft.getHours()}
                                    max={23}
                                    label="Hour"
                                    onChange={(hours) => setTimePart(hours, draft.getMinutes())}
                                />
                                <span className="text-muted-foreground">:</span>
                                <TimePart
                                    value={draft.getMinutes()}
                                    max={59}
                                    label="Minute"
                                    onChange={(minutes) => setTimePart(draft.getHours(), minutes)}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    ['In 1 hour', 60 * 60 * 1000],
                                    ['Tomorrow', 24 * 60 * 60 * 1000],
                                    ['In a week', 7 * 24 * 60 * 60 * 1000],
                                ] as const
                            ).map(([label, ms]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => shift(ms)}
                                    className="rounded-full bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-xl bg-muted/20 px-3 py-2 text-xs">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-muted-foreground">Selected</span>
                                <span className="font-medium">{formatDisplay(draft)}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {value && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        onChange('')
                                        setOpen(false)
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                            <Button type="button" className="flex-1" onClick={confirm}>
                                Confirm
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

/** Two-digit spinner that keeps the field readable while it is being retyped. */
function TimePart({
    value,
    max,
    label,
    onChange,
}: {
    value: number
    max: number
    label: string
    onChange: (value: number) => void
}) {
    const [text, setText] = useState(pad(value))

    useEffect(() => {
        setText(pad(value))
    }, [value])

    const commit = (raw: string) => {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed)) {
            setText(pad(value))
            return
        }
        const clamped = Math.min(max, Math.max(0, Math.floor(parsed)))
        onChange(clamped)
        setText(pad(clamped))
    }

    return (
        <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
                if (e.key === 'ArrowUp') commit(String(value + 1 > max ? 0 : value + 1))
                if (e.key === 'ArrowDown') commit(String(value - 1 < 0 ? max : value - 1))
            }}
            className="w-10 rounded-lg bg-background/60 py-1 text-center text-sm font-semibold tabular-nums outline-none ring-1 ring-border/60 focus:ring-primary/60"
        />
    )
}
