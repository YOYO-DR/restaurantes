import { useEffect, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

function formatImageSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 B"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function OrderChatImagePreview({ file, onRemove }) {
  const previewUrl = useMemo(() => {
    if (!(file instanceof File)) {
      return ""
    }
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (!(file instanceof File)) {
    return null
  }

  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="h-14 w-14 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 text-xs">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-muted-foreground">{formatImageSize(file.size)}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
