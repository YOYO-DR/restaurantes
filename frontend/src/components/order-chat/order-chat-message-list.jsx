import { useEffect, useMemo, useRef, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react"

function formatMessageTime(value) {
  if (!value) {
    return ""
  }
  try {
    return new Date(value).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function formatMessageDate(value) {
  if (!value) {
    return ""
  }
  try {
    return new Date(value).toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function usePinchZoom({ enabled, onScale }) {
  const pointersRef = useRef(new Map())
  const pinchStartRef = useRef(null)

  const onPointerDown = (event) => {
    if (!enabled) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values())
      pinchStartRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      }
    }
  }

  const onPointerMove = (event) => {
    if (!enabled || !pointersRef.current.has(event.pointerId)) {
      return
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size !== 2 || !pinchStartRef.current) {
      return
    }
    const [a, b] = Array.from(pointersRef.current.values())
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (!pinchStartRef.current.distance) {
      return
    }
    const ratio = distance / pinchStartRef.current.distance
    onScale(ratio)
  }

  const onPointerUp = (event) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp }
}

export function OrderChatMessageList({ messages, currentSide = "customer" }) {
  const [expandedIndex, setExpandedIndex] = useState(-1)
  const [zoom, setZoom] = useState(1)
  const [loadedMap, setLoadedMap] = useState({})

  const imageMessages = useMemo(
    () => messages.filter((item) => item.has_image && item.image_url && !item.image_purged),
    [messages],
  )

  const expandedImage = expandedIndex >= 0 ? imageMessages[expandedIndex] : null

  useEffect(() => {
    if (!expandedImage) {
      setZoom(1)
    }
  }, [expandedImage?.id])

  const pinchHandlers = usePinchZoom({
    enabled: Boolean(expandedImage),
    onScale: (ratio) => {
      setZoom((current) => {
        const next = current * ratio
        return Math.min(4, Math.max(1, next))
      })
    },
  })

  const openImage = (messageId) => {
    const idx = imageMessages.findIndex((item) => item.id === messageId)
    if (idx >= 0) {
      setExpandedIndex(idx)
    }
  }

  const nextImage = () => {
    setExpandedIndex((current) => {
      if (current < 0) {
        return current
      }
      return (current + 1) % imageMessages.length
    })
  }

  const prevImage = () => {
    setExpandedIndex((current) => {
      if (current < 0) {
        return current
      }
      return (current - 1 + imageMessages.length) % imageMessages.length
    })
  }

  return (
    <>
      <ScrollArea className="h-[55vh] rounded-md border border-border p-3">
        <div className="space-y-3">
          {messages.map((message) => {
            const isOwn = currentSide === "restaurant"
              ? message.sender_kind === "restaurant"
              : message.sender_kind !== "restaurant"

            const imageUrl = message.image_url || ""
            const downloadUrl = message.image_download_url || imageUrl
            const isLoaded = Boolean(loadedMap[message.id])

            return (
              <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[84%] rounded-lg px-3 py-2 text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="mb-1 text-[11px] opacity-80">{message.sender_label}</p>

                  {message.body ? (
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  ) : null}

                  {message.has_image && imageUrl ? (
                    <button
                      type="button"
                      className="mt-2 block w-full overflow-hidden rounded-md border border-border/60 bg-background/60 text-left cursor-zoom-in"
                      onClick={() => openImage(message.id)}
                    >
                      {!isLoaded ? (
                        <div className="h-40 w-full animate-pulse bg-muted" />
                      ) : null}
                      <img
                        src={imageUrl}
                        alt="Imagen del chat"
                        className={`max-h-52 w-full object-cover transition-opacity ${isLoaded ? "opacity-100" : "opacity-0"}`}
                        loading="lazy"
                        onLoad={() => {
                          setLoadedMap((current) => ({ ...current, [message.id]: true }))
                        }}
                      />
                    </button>
                  ) : null}

                  {message.image_purged ? (
                    <p className="mt-2 text-xs opacity-80">Imagen eliminada</p>
                  ) : null}

                  {downloadUrl && !message.image_purged ? (
                    <a
                      href={downloadUrl}
                      download
                      className="mt-1 inline-flex items-center gap-1 text-xs underline underline-offset-2"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </a>
                  ) : null}

                  <p className="mt-1 text-[10px] opacity-70">{formatMessageTime(message.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <Dialog
        open={Boolean(expandedImage)}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedIndex(-1)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Imagen del chat</DialogTitle>
            <DialogDescription>
              {expandedImage
                ? `Enviada por ${expandedImage.sender_label} el ${formatMessageDate(expandedImage.created_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {expandedImage ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={prevImage}
                    className="inline-flex items-center rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    className="inline-flex items-center rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {expandedIndex + 1} / {imageMessages.length}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
                    className="inline-flex items-center rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((current) => Math.min(4, current + 0.25))}
                    className="inline-flex items-center rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className="overflow-auto rounded-md border border-border bg-black/5 p-2 touch-none"
                onPointerDown={pinchHandlers.onPointerDown}
                onPointerMove={pinchHandlers.onPointerMove}
                onPointerUp={pinchHandlers.onPointerUp}
                onPointerCancel={pinchHandlers.onPointerUp}
              >
                <img
                  src={expandedImage.image_url}
                  alt="Imagen ampliada del chat"
                  className="mx-auto max-h-[70vh] w-auto object-contain transition-transform duration-150"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                />
              </div>

              <a
                href={expandedImage.image_download_url || expandedImage.image_url}
                download
                className="inline-flex items-center gap-2 text-sm underline underline-offset-2"
              >
                <Download className="h-4 w-4" /> Abrir/descargar en otra pestana
              </a>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
