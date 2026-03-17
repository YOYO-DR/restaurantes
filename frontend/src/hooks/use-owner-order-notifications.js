import { useEffect } from "react"
import { toast } from "sonner"
import { API_BASE_URL, getAccessToken } from "@/lib/api"

function buildSocketUrl(pathname) {
  const apiUrl = new URL(API_BASE_URL)
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${apiUrl.host}${pathname}`
}

export function useOwnerOrderNotifications(ownerId, onNewOrder) {
  useEffect(() => {
    if (!ownerId) {
      return undefined
    }

    const socket = new WebSocket(buildSocketUrl(`/ws/orders/${ownerId}/`))

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type !== "owner.order.created" && message.type !== "owner.order.updated") {
          return
        }
        onNewOrder?.(message.payload)
        if (message.type === "owner.order.created") {
          toast.success(`Nuevo pedido ${message.payload.order_code}`)
        }
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      socket.close()
    }
  }, [onNewOrder, ownerId])
}

export function useUserOrderNotifications(userId, onOrderUpdate) {
  useEffect(() => {
    if (!userId) {
      return undefined
    }

    const accessToken = getAccessToken()
    if (!accessToken) {
      return undefined
    }

    const socket = new WebSocket(
      buildSocketUrl(`/ws/user-orders/${userId}/?access_token=${encodeURIComponent(accessToken)}`)
    )

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type !== "user.order.updated") {
          return
        }
        onOrderUpdate?.(message.payload)
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      socket.close()
    }
  }, [onOrderUpdate, userId])
}

export function useGuestOrderNotifications(orderId, onOrderUpdate) {
  useEffect(() => {
    if (!orderId) {
      return undefined
    }

    const socket = new WebSocket(buildSocketUrl(`/ws/guest-orders/${orderId}/`))

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type !== "guest.order.updated") {
          return
        }
        onOrderUpdate?.(message.payload)
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      socket.close()
    }
  }, [onOrderUpdate, orderId])
}
