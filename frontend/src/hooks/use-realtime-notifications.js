import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"
import { useNotificationCenterContext } from "@/context/notification-center-context"
import { realtimeClient } from "@/lib/realtime-client"
import { getAccessToken } from "@/lib/api"

const TOAST_EVENTS = new Set([
  "order.created",
  "order.chat_message",
  "inventory.low_stock",
  "inventory.out_of_stock",
  "order.cancelled",
  "order.status_changed",
  "loyalty.points_earned",
  "loyalty.points_reverted",
  "loyalty.tier_upgraded",
  "loyalty.reward_redeemed",
])

export function toastMessageForEvent(message, payload) {
  if (message.event_type === "order.created") {
    return `Nuevo pedido ${payload.order_code || ""}`.trim()
  }
  if (message.event_type === "order.cancelled") {
    return `Pedido ${payload.order_code || ""} cancelado`.trim()
  }
  if (message.event_type === "order.status_changed") {
    const orderCode = payload.order_code || ""
    const statusName = payload.status_name || "actualizado"
    return `Pedido ${orderCode}: ${statusName}`.trim()
  }
  if (message.event_type === "order.chat_message") {
    const orderCode = payload.order_code || ""
    const sender = payload.sender_label || "nuevo mensaje"
    return `Mensaje en ${orderCode}: ${sender}`.trim()
  }
  if (message.event_type === "inventory.out_of_stock") {
    return `${payload.inventory_item_name || "Item"} agotado`
  }
  if (message.event_type === "inventory.low_stock") {
    return `Stock bajo de ${payload.inventory_item_name || "item"}`
  }
  if (message.event_type === "loyalty.points_earned") {
    const points = payload.points || 0
    const restaurant = payload.restaurant_name || "tu restaurante"
    return `Sumaste ${points} puntos en ${restaurant}`
  }
  if (message.event_type === "loyalty.points_reverted") {
    const points = payload.points || 0
    return `Se descontaron ${points} puntos por cancelacion`
  }
  if (message.event_type === "loyalty.tier_upgraded") {
    return `Subiste a nivel ${payload.tier || "nuevo"}`
  }
  if (message.event_type === "loyalty.reward_redeemed") {
    return `Canjeaste: ${payload.reward_name || "recompensa"}`
  }
  return "Tienes una nueva notificacion"
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
