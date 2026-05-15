import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/context/auth-context"
import {
  createNotificationEvent,
  getNotificationCenter,
  markAllNotificationsRead,
} from "@/services/orders"

const NotificationCenterContext = createContext(null)

function buildRealtimeNotificationItem(eventType, payload) {
  return {
    id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type_code: eventType.replace(/\./g, "_"),
    payload_json: {
      event_type: eventType,
      ...(payload || {}),
    },
    created_at: new Date().toISOString(),
    read_at: null,
  }
}

export function NotificationCenterProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const payload = await getNotificationCenter()
      setUnreadCount(payload.unread_count || 0)
      setItems(payload.items || [])
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    load()
  }, [load])

  const prependRealtimeEvent = useCallback((eventType, payload) => {
    const item = buildRealtimeNotificationItem(eventType, payload)
    setItems((current) => [item, ...current].slice(0, 50))
    setUnreadCount((current) => current + 1)
  }, [])

  const value = useMemo(() => ({
    unreadCount,
    items,
    isLoading,
    setItems,
    setUnreadCount,
    prependRealtimeEvent,
    reload: load,
    markAllRead: async () => {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setItems((current) => current.map((item) => ({ ...item, read_at: new Date().toISOString() })))
    },
    createNotification: async (payload) => {
      await createNotificationEvent(payload)
      await load()
    },
  }), [isLoading, items, load, prependRealtimeEvent, unreadCount])

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>
}

export function useNotificationCenterContext() {
  const context = useContext(NotificationCenterContext)
  if (!context) {
    throw new Error("useNotificationCenterContext must be used within NotificationCenterProvider")
  }
  return context
}
