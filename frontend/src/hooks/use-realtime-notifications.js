import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"
import { useNotificationCenterContext } from "@/context/notification-center-context"
import { realtimeClient } from "@/lib/realtime-client"
import { getAccessToken } from "@/lib/api"

const TOAST_EVENTS = new Set([
  "order.created",
  "inventory.low_stock",
  "inventory.out_of_stock",
  "order.cancelled",
])

function toastMessageForEvent(message, payload) {
  if (message.event_type === "order.created") {
    return `Nuevo pedido ${payload.order_code || ""}`.trim()
  }
  if (message.event_type === "order.cancelled") {
    return `Pedido cancelado ${payload.order_code || ""}`.trim()
  }
  if (message.event_type === "inventory.out_of_stock") {
    return `${payload.inventory_item_name || "Item"} agotado`
  }
  if (message.event_type === "inventory.low_stock") {
    return `Stock bajo de ${payload.inventory_item_name || "item"}`
  }
  return "Nueva notificacion"
}

export function useRealtimeNotifications() {
  const { user, activeRole, isAuthenticated } = useAuth()
  const { prependRealtimeEvent } = useNotificationCenterContext()

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      realtimeClient.disconnect()
      return
    }

    const accessToken = getAccessToken()
    if (!accessToken) {
      realtimeClient.disconnect()
      return
    }

    realtimeClient.connect({ accessToken, activeRole })

    const unsubscribeAny = realtimeClient.subscribe("*", (payload, message) => {
      prependRealtimeEvent(message.event_type, payload)
      if (TOAST_EVENTS.has(message.event_type)) {
        toast.success(toastMessageForEvent(message, payload))
      }
    })

    return () => {
      unsubscribeAny()
    }
  }, [activeRole, isAuthenticated, prependRealtimeEvent, user?.id])
}
