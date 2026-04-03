'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { RotateCcw, Check, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
    onSave: (dataUrl: string) => void
    onClear?: () => void
    initialValue?: string
    disabled?: boolean
    className?: string
}

interface Point { x: number; y: number; pressure?: number }

export default function SignaturePad({ onSave, onClear, initialValue, disabled = false, className }: SignaturePadProps) {
    const canvasRef    = useRef<HTMLCanvasElement>(null)
    const wrapperRef   = useRef<HTMLDivElement>(null)
    const isDrawing    = useRef(false)
    const lastPoint    = useRef<Point | null>(null)
    const points       = useRef<Point[]>([])
    const [isEmpty, setIsEmpty]     = useState(!initialValue)
    const [hasUnsaved, setHasUnsaved] = useState(false)

    // ── Initialize canvas ──────────────────────────────────────────────────
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // HiDPI
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width  = rect.width  * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.strokeStyle = '#1a2332'
        ctx.lineWidth   = 2
        ctx.lineCap     = 'round'
        ctx.lineJoin    = 'round'

        if (initialValue) {
            const img = new window.Image()
            img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
            img.src = initialValue
            setIsEmpty(false)
        }
    }, [initialValue])

    useEffect(() => {
        initCanvas()
        const ro = new ResizeObserver(initCanvas)
        if (wrapperRef.current) ro.observe(wrapperRef.current)
        return () => ro.disconnect()
    }, [initCanvas])

    // ── Coordinate helper ──────────────────────────────────────────────────
    const getPoint = (e: MouseEvent | TouchEvent): Point | null => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect   = canvas.getBoundingClientRect()

        if ('touches' in e) {
            if (e.touches.length === 0) return null
            const t = e.touches[0]
            return { x: t.clientX - rect.left, y: t.clientY - rect.top, pressure: (t as Touch & { force?: number }).force || 0.5 }
        }
        return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top }
    }

    // ── Smooth Bézier drawing ──────────────────────────────────────────────
    const drawSmooth = useCallback((pts: Point[]) => {
        const canvas = canvasRef.current
        if (!canvas || pts.length < 2) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)

        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2
            const my = (pts[i].y + pts[i + 1].y) / 2
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
        }

        const last = pts[pts.length - 1]
        ctx.lineTo(last.x, last.y)
        ctx.stroke()
    }, [])

    // ── Event handlers ─────────────────────────────────────────────────────
    const onStart = useCallback((e: MouseEvent | TouchEvent) => {
        if (disabled) return
        e.preventDefault()
        const pt = getPoint(e)
        if (!pt) return
        isDrawing.current = true
        lastPoint.current  = pt
        points.current     = [pt]

        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 1, 0, Math.PI * 2)
            ctx.fill()
        }
    }, [disabled])

    const onMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDrawing.current || disabled) return
        e.preventDefault()
        const pt = getPoint(e)
        if (!pt) return
        points.current.push(pt)

        // Draw live with smoothing over last 4 points
        const recent = points.current.slice(-4)
        drawSmooth(recent)
        lastPoint.current = pt
        setIsEmpty(false)
        setHasUnsaved(true)
    }, [disabled, drawSmooth])

    const onEnd = useCallback(() => {
        isDrawing.current = false
        lastPoint.current = null
        points.current    = []
    }, [])

    // ── Attach events ──────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const opts: AddEventListenerOptions = { passive: false }
        canvas.addEventListener('mousedown',  onStart, opts)
        canvas.addEventListener('mousemove',  onMove,  opts)
        canvas.addEventListener('mouseup',    onEnd)
        canvas.addEventListener('mouseleave', onEnd)
        canvas.addEventListener('touchstart', onStart, opts)
        canvas.addEventListener('touchmove',  onMove,  opts)
        canvas.addEventListener('touchend',   onEnd)

        return () => {
            canvas.removeEventListener('mousedown',  onStart)
            canvas.removeEventListener('mousemove',  onMove)
            canvas.removeEventListener('mouseup',    onEnd)
            canvas.removeEventListener('mouseleave', onEnd)
            canvas.removeEventListener('touchstart', onStart)
            canvas.removeEventListener('touchmove',  onMove)
            canvas.removeEventListener('touchend',   onEnd)
        }
    }, [onStart, onMove, onEnd])

    // ── Actions ────────────────────────────────────────────────────────────
    const clear = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, rect.width, rect.height)
        setIsEmpty(true)
        setHasUnsaved(false)
        onClear?.()
    }

    const save = () => {
        const canvas = canvasRef.current
        if (!canvas || isEmpty) return
        const dataUrl = canvas.toDataURL('image/png')
        onSave(dataUrl)
        setHasUnsaved(false)
    }

    return (
        <div className={cn('space-y-3', className)}>
            {/* Canvas wrapper */}
            <div ref={wrapperRef} className={cn(
                'relative rounded-2xl overflow-hidden border-2 transition-all duration-200',
                disabled ? 'opacity-60 pointer-events-none border-gray-200' : 'border-dashed border-gray-200 hover:border-[#008751]/40',
                isDrawing.current && !disabled ? 'border-[#008751]/60 shadow-[0_0_0_3px_rgba(0,135,81,0.08)]' : '',
            )} style={{ height: 160, background: '#fff' }}>
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full touch-none"
                    style={{ cursor: disabled ? 'default' : 'crosshair' }}
                />
                {/* Placeholder */}
                {isEmpty && !disabled && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
                        <PenLine size={22} className="text-gray-200" />
                        <p className="text-[11px] text-gray-300 font-medium">Signez ici avec votre doigt ou la souris</p>
                    </div>
                )}
                {/* Guideline */}
                {!isEmpty || !disabled ? (
                    <div className="absolute bottom-8 left-6 right-6 h-px bg-gray-100 pointer-events-none" />
                ) : null}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
                <button
                    type="button"
                    title="Effacer la signature"
                    onClick={clear}
                    disabled={isEmpty || disabled}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all text-[12px] font-semibold disabled:opacity-30 disabled:pointer-events-none"
                >
                    <RotateCcw size={13} />
                    Effacer
                </button>
                <button
                    type="button"
                    title="Valider la signature"
                    onClick={save}
                    disabled={isEmpty || !hasUnsaved || disabled}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#008751] text-white font-bold text-[12px] hover:bg-[#006e42] transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm"
                >
                    <Check size={13} />
                    Valider la signature
                </button>
            </div>
        </div>
    )
}
