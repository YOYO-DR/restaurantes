import { createContext, useContext, useMemo } from "react"
import { useAuth } from "@/context/auth-context"
import { useOwnerOrderNotifications } from "@/hooks/use-owner-order-notifications"
import { useOwnerOrders } from "@/hooks/use-orders"

const OwnerOrdersContext = createContext(null)

function countUnfinishedOrders(orders) {
  return orders.filter((order) => order.status_code !== "delivered").length
}

export function OwnerOrdersProvider({ children }) {
  const { user } = useAuth()
  const ownerOrders = useOwnerOrders()

  useOwnerOrderNotifications(user?.id, ownerOrders.mergeOrder)

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
