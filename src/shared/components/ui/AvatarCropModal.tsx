import { useState, useRef, useCallback } from 'react'
import { Check, X, ZoomIn, ZoomOut, Move } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'

interface Props {
  file: File
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

export function AvatarCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgSrc] = useState(() => URL.createObjectURL(file))

  const CROP_SIZE = 260

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [dragging, dragStart])

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    setDragging(true)
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    const t = e.touches[0]
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y })
  }

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img) return

    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!

    // Calcular proporção entre tamanho natural e exibido
    const displaySize = CROP_SIZE * scale
    const ratio = img.naturalWidth / displaySize

    // Centro do crop na imagem original
    const centerX = img.naturalWidth / 2 - offset.x * ratio
    const centerY = img.naturalHeight / 2 - offset.y * ratio
    const cropRadius = (CROP_SIZE / 2) * ratio

    ctx.drawImage(
      img,
      centerX - cropRadius, centerY - cropRadius,
      cropRadius * 2, cropRadius * 2,
      0, 0, 400, 400
    )

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.9)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-4 w-4" />
            Ajustar foto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground text-center">
            Arraste para reposicionar · Use o zoom para ajustar o tamanho
          </p>

          {/* Área de crop circular */}
          <div className="flex justify-center">
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none"
              style={{ width: CROP_SIZE, height: CROP_SIZE, boxShadow: '0 0 0 4px hsl(var(--primary))' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => setDragging(false)}
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="crop preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: CROP_SIZE,
                  height: 'auto',
                  objectFit: 'cover',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              <Check className="h-4 w-4" />
              Usar foto
            </Button>
          </div>
        </div>

        {/* Canvas oculto para renderizar o crop */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}