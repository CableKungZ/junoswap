'use client'

import { useEffect, useRef, useCallback } from 'react'
import warpVert from '@/shaders/warp.vert'
import warpFrag from '@/shaders/warp.frag'

const BG_COLOR = { r: 0.016, g: 0.02, b: 0.043 } // near-black void #04050B
const ACCENT1 = { r: 1.0, g: 0.302, b: 0.0 } // #FF4D00 — deep orange-red (limb edges)
const ACCENT2 = { r: 1.0, g: 0.569, b: 0.302 } // #FF914D — orange (mid-limb / atmosphere)
const ACCENT3 = { r: 1.0, g: 0.843, b: 0.0 } // #FFD700 — gold (crest rim light)

const ENTRANCE_DURATION = 3.0
const MOUSE_LERP = 0.05
// Reduced-motion static frame: sin(2.0 * 0.785) ≈ 1 puts the rim breathe at peak
const STATIC_TIME = 2.0

interface Vec2 {
    x: number
    y: number
}

function isMobile() {
    return typeof window !== 'undefined' && window.innerWidth < 768
}

function isLowEnd() {
    if (typeof navigator === 'undefined') return false
    return (navigator.hardwareConcurrency ?? 8) < 4
}

function compileShader(gl: WebGLRenderingContext, source: string, type: number) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function createProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string) {
    const vert = compileShader(gl, vertSrc, gl.VERTEX_SHADER)
    const frag = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER)
    if (!vert || !frag) return null

    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
    }

    // Shaders can be freed after linking
    gl.deleteShader(vert)
    gl.deleteShader(frag)
    return program
}

export function HeroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const bufferRef = useRef<WebGLBuffer | null>(null)
    const rafRef = useRef(0)
    const startTimeRef = useRef(0)
    const mouseRef = useRef<Vec2>({ x: 0.5, y: 0.5 })
    const smoothMouseRef = useRef<Vec2>({ x: 0.5, y: 0.5 })
    const isVisibleRef = useRef(true)
    const frameCountRef = useRef(0)
    const uniformsRef = useRef({
        uTime: null as WebGLUniformLocation | null,
        uResolution: null as WebGLUniformLocation | null,
        uMouse: null as WebGLUniformLocation | null,
        uIntensity: null as WebGLUniformLocation | null,
        uAccentColor1: null as WebGLUniformLocation | null,
        uAccentColor2: null as WebGLUniformLocation | null,
        uAccentColor3: null as WebGLUniformLocation | null,
        uBgColor: null as WebGLUniformLocation | null,
    })

    const setupWebGL = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) {
            console.warn('[HeroBG] No canvas element')
            return false
        }

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        if (!gl) {
            console.warn('[HeroBG] WebGL not supported')
            return false
        }

        glRef.current = gl

        const program = createProgram(gl, warpVert, warpFrag)
        if (!program) {
            console.warn('[HeroBG] Shader program creation failed')
            return false
        }
        programRef.current = program

        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
        const buffer = gl.createBuffer()!
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
        bufferRef.current = buffer

        gl.useProgram(program)

        const aPosition = gl.getAttribLocation(program, 'aPosition')
        gl.enableVertexAttribArray(aPosition)
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

        const u = uniformsRef.current
        u.uTime = gl.getUniformLocation(program, 'uTime')
        u.uResolution = gl.getUniformLocation(program, 'uResolution')
        u.uMouse = gl.getUniformLocation(program, 'uMouse')
        u.uIntensity = gl.getUniformLocation(program, 'uIntensity')
        u.uAccentColor1 = gl.getUniformLocation(program, 'uAccentColor1')
        u.uAccentColor2 = gl.getUniformLocation(program, 'uAccentColor2')
        u.uAccentColor3 = gl.getUniformLocation(program, 'uAccentColor3')
        u.uBgColor = gl.getUniformLocation(program, 'uBgColor')

        gl.uniform3f(u.uBgColor, BG_COLOR.r, BG_COLOR.g, BG_COLOR.b)
        gl.uniform3f(u.uAccentColor1, ACCENT1.r, ACCENT1.g, ACCENT1.b)
        gl.uniform3f(u.uAccentColor2, ACCENT2.r, ACCENT2.g, ACCENT2.b)
        gl.uniform3f(u.uAccentColor3, ACCENT3.r, ACCENT3.g, ACCENT3.b)

        // After a context restore the canvas keeps its size, so resize()'s
        // size-changed guard would skip re-uploading uResolution/viewport
        // into the fresh program — set them here when the size is known.
        if (canvas.width > 0) {
            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.uniform2f(u.uResolution, canvas.width, canvas.height)
        }

        return true
    }, [])

    const resize = useCallback(() => {
        const canvas = canvasRef.current
        const gl = glRef.current
        if (!canvas || !gl) return

        const rect = canvas.parentElement?.getBoundingClientRect()
        if (!rect) return

        const mobile = isMobile()
        const lowEnd = isLowEnd()
        const dpr = lowEnd ? 0.375 : mobile ? 0.5 : 0.75

        const width = Math.floor(rect.width * dpr)
        const height = Math.floor(rect.height * dpr)

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            gl.viewport(0, 0, width, height)
            gl.uniform2f(uniformsRef.current.uResolution, width, height)
        }
    }, [])

    useEffect(() => {
        if (!setupWebGL()) return

        startTimeRef.current = performance.now() / 1000

        const gl = glRef.current!
        const u = uniformsRef.current
        const mobile = isMobile()
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        // Reduced motion: no RAF loop — render one finished frame (entrance
        // complete, breathe at peak) and re-render only on resize.
        const drawStatic = () => {
            if (!glRef.current) return
            gl.uniform1f(u.uTime, STATIC_TIME)
            gl.uniform2f(u.uMouse, 0.5, 0.5)
            gl.uniform1f(u.uIntensity, 1.0)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
        }

        // Defer initial resize — parent may not have layout dimensions yet
        requestAnimationFrame(() => {
            resize()
            // Safety net: if still 0, try again next frame
            if (canvasRef.current?.width === 0) {
                requestAnimationFrame(() => {
                    resize()
                    if (reducedMotion) drawStatic()
                })
            } else if (reducedMotion) {
                drawStatic()
            }
        })

        const resizeObserver = new ResizeObserver(() => {
            resize()
            if (reducedMotion) drawStatic()
        })
        if (canvasRef.current?.parentElement) {
            resizeObserver.observe(canvasRef.current.parentElement)
        }

        // IntersectionObserver: pause the render loop while off-screen
        const intersectionObserver = new IntersectionObserver(
            ([entry]) => {
                isVisibleRef.current = entry?.isIntersecting ?? false
            },
            { threshold: 0 }
        )
        if (canvasRef.current?.parentElement) {
            intersectionObserver.observe(canvasRef.current.parentElement)
        }

        const onMouseMove = (e: MouseEvent) => {
            mouseRef.current = {
                x: e.clientX / window.innerWidth,
                y: 1.0 - e.clientY / window.innerHeight,
            }
        }
        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0]
            if (touch) {
                mouseRef.current = {
                    x: touch.clientX / window.innerWidth,
                    y: 1.0 - touch.clientY / window.innerHeight,
                }
            }
        }
        if (!reducedMotion) {
            window.addEventListener('mousemove', onMouseMove, { passive: true })
            window.addEventListener('touchmove', onTouchMove, { passive: true })
        }

        const render = () => {
            rafRef.current = requestAnimationFrame(render)

            if (!isVisibleRef.current) return

            // Mobile: skip every other frame for 30fps
            frameCountRef.current++
            if (mobile && frameCountRef.current % 2 !== 0) return

            const now = performance.now() / 1000
            const elapsed = now - startTimeRef.current

            const sm = smoothMouseRef.current
            const rm = mouseRef.current
            sm.x += (rm.x - sm.x) * MOUSE_LERP
            sm.y += (rm.y - sm.y) * MOUSE_LERP

            if (mobile) {
                sm.x += Math.sin(elapsed * 0.3) * 0.002
                sm.y += Math.cos(elapsed * 0.25) * 0.002
            }

            const progress = Math.min(elapsed / ENTRANCE_DURATION, 1.0)
            const intensity = 1.0 - Math.pow(1.0 - progress, 3)

            gl.uniform1f(u.uTime, elapsed)
            gl.uniform2f(u.uMouse, sm.x, sm.y)
            gl.uniform1f(u.uIntensity, intensity)

            gl.drawArrays(gl.TRIANGLES, 0, 6)
        }

        // preventDefault on loss marks the context restorable; on restore the
        // same context object becomes valid again, so re-running setupWebGL
        // rebuilds the program/buffer and re-uploads uniforms. startTimeRef
        // is kept so a mid-session restore doesn't replay the entrance.
        const onContextLost = (e: Event) => {
            e.preventDefault()
            cancelAnimationFrame(rafRef.current)
        }
        const onContextRestored = () => {
            if (!setupWebGL()) return
            if (reducedMotion) {
                drawStatic()
            } else {
                rafRef.current = requestAnimationFrame(render)
            }
        }
        const canvasEl = canvasRef.current
        canvasEl?.addEventListener('webglcontextlost', onContextLost)
        canvasEl?.addEventListener('webglcontextrestored', onContextRestored)

        if (!reducedMotion) {
            rafRef.current = requestAnimationFrame(render)
        }

        return () => {
            cancelAnimationFrame(rafRef.current)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('touchmove', onTouchMove)
            canvasEl?.removeEventListener('webglcontextlost', onContextLost)
            canvasEl?.removeEventListener('webglcontextrestored', onContextRestored)

            const glCleanup = glRef.current
            if (glCleanup) {
                if (programRef.current) glCleanup.deleteProgram(programRef.current)
                if (bufferRef.current) glCleanup.deleteBuffer(bufferRef.current)
                glRef.current = null
                programRef.current = null
                bufferRef.current = null
            }
        }
    }, [setupWebGL, resize])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 -z-10 h-full w-full"
            aria-hidden="true"
        />
    )
}
