import { useEffect, useState } from "react"

import { getPlatformChatConfig } from "@/services/order-chat"

const DEFAULT_CONFIG = {
  chat_images_enabled: true,
  chat_image_max_mb: 10,
  chat_image_allowed_mimes: ["image/jpeg", "image/png", "image/webp"],
  chat_post_close_purge_hours: 24,
}

export function usePlatformChatConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    getPlatformChatConfig()
      .then((payload) => {
        if (cancelled) {
          return
        }
        setConfig({
          ...DEFAULT_CONFIG,
          ...payload,
        })
        setError("")
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setError(loadError.message || "No fue posible cargar la configuracion de chat")
      })
      .finally(() => {
        if (cancelled) {
          return
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    config,
    isLoading,
    error,
  }
}
