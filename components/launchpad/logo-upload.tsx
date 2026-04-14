'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X } from 'lucide-react'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
const MAX_FILE_SIZE = 1024 * 1024 // 1MB

interface LogoUploadProps {
    onFileSelect: (file: File | null) => void
}

export function LogoUpload({ onFileSelect }: LogoUploadProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cleanup object URL on unmount or when preview changes
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    const handleFile = useCallback(
        (file: File) => {
            setErrorMessage(null)

            if (!ALLOWED_TYPES.includes(file.type)) {
                setErrorMessage('Please select an image file (PNG, JPG, GIF, SVG, or WebP).')
                return
            }

            if (file.size > MAX_FILE_SIZE) {
                setErrorMessage('File size must be under 1MB.')
                return
            }

            const localUrl = URL.createObjectURL(file)
            setPreviewUrl(localUrl)
            onFileSelect(file)
        },
        [onFileSelect]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
        },
        [handleFile]
    )

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
        },
        [handleFile]
    )

    const clear = useCallback(() => {
        setPreviewUrl(null)
        setErrorMessage(null)
        onFileSelect(null)
    }, [onFileSelect])

    return (
        <div className="space-y-2">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleInputChange}
            />

            {previewUrl ? (
                <div className="relative rounded-lg border bg-card p-2">
                    <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewUrl}
                            alt="Token logo preview"
                            className="h-12 w-12 rounded-md object-cover"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Ready to upload</p>
                        </div>
                        <button
                            type="button"
                            onClick={clear}
                            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                        isDragOver
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                    }`}
                >
                    <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                        Drag & drop an image or click to browse
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                        PNG, JPG, GIF, SVG, WebP (max 1MB)
                    </p>
                </div>
            )}

            {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>
    )
}
