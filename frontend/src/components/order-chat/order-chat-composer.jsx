import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImagePlus, Loader2, SendHorizontal } from "lucide-react"

import { OrderChatImagePreview } from "@/components/order-chat/order-chat-image-preview"

function validateImage(file, config) {
  if (!(file instanceof File)) {
    return ""
  }
  if (!config.chat_images_enabled) {
    return "El envio de imagenes esta deshabilitado"
  }
  const allowed = new Set(config.chat_image_allowed_mimes || [])
  if (allowed.size > 0 && !allowed.has(file.type)) {
    return "Tipo de imagen no permitido"
  }
  const maxBytes = Number(config.chat_image_max_mb || 10) * 1024 * 1024
  if (file.size > maxBytes) {
    return `La imagen supera ${config.chat_image_max_mb} MB`
  }
  return ""
}

export function OrderChatComposer({ onSend, isSending, disabled, config }) {
  const [body, setBody] = useState("")
  const [image, setImage] = useState(null)
  const [validationError, setValidationError] = useState("")
  const fileInputRef = useRef(null)

  const submit = async () => {
    const trimmed = body.trim()
    if (!trimmed && !(image instanceof File)) {
      return
    }
    await onSend({ body: trimmed, image })
    setBody("")
    setImage(null)
    setValidationError("")
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escribe un mensaje..."
        rows={3}
        disabled={disabled || isSending}
      />

      <OrderChatImagePreview
        file={image}
        onRemove={() => {
          setImage(null)
          setValidationError("")
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }}
      />

      {validationError ? <p className="text-xs text-destructive">{validationError}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={(config.chat_image_allowed_mimes || []).join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              const error = validateImage(file, config)
              if (error) {
                setValidationError(error)
                setImage(null)
                return
              }
              setValidationError("")
              setImage(file || null)
            }}
            disabled={disabled || isSending || !config.chat_images_enabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isSending || !config.chat_images_enabled}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Adjuntar
          </Button>
        </div>

        <Button type="button" size="sm" onClick={submit} disabled={disabled || isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando
            </>
          ) : (
            <>
              <SendHorizontal className="mr-2 h-4 w-4" /> Enviar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
