import { createContext, useContext, useEffect, useMemo } from "react"
import { useOwnerOrders } from "@/hooks/use-orders"
import { realtimeClient } from "@/lib/realtime-client"

const OwnerOrdersContext = createContext(null)

function countUnfinishedOrders(orders) {
  return orders.filter((order) => order.status_code !== "delivered").length
}

export function OwnerOrdersProvider({ children }) {
  const ownerOrders = useOwnerOrders()
  const { mergeOrder } = ownerOrders

  useEffect(() => {
    const orderEventTypes = [
      "order.created",
      "order.status_changed",
      "order.cancelled",
      "order.payment_completed",
      "order.payment_failed",
    ]

    const unsubs = orderEventTypes.map((eventType) => (
      realtimeClient.subscribe(eventType, (payload) => {
        mergeOrder(payload)
      })
    ))

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe())
    }
  }, [mergeOrder])

  const value = useMemo(() => ({
    ...ownerOrders,
    unfinishedOrdersCount: countUnfinishedOrders(ownerOrders.orders),
  }), [ownerOrders])

  return <OwnerOrdersContext.Provider value={value}>{children}</OwnerOrdersContext.Provider>
}

export function useOwnerOrdersContext() {
  const context = useContext(OwnerOrdersContext)
  if (!context) {
    throw new Error("useOwnerOrdersContext must be used within OwnerOrdersProvider")
  }
  return context
}
