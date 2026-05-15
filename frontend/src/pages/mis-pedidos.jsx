import { Link } from "react-router-dom"
import { toast } from "sonner"
import { OrderChatSheet } from "@/components/order-chat/order-chat-sheet"
import { RestaurantContactDialog } from "@/components/order-chat/restaurant-contact-dialog"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useOrderChatUnreadCount } from "@/hooks/use-order-chat"
import { useGuestOrder, useGuestOrderCancellation } from "@/hooks/use-orders"
import { getGuestOrders, removeGuestOrder } from "@/lib/guest-orders"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, MapPin, MessageCircle, Phone, ShoppingBag, Trash2 } from "lucide-react"

export default function GuestOrdersPage() {
  const initialEntries = getGuestOrders()
  const [entries, setEntries] = useState(initialEntries)
  const [selectedOrderId, setSelectedOrderId] = useState(initialEntries[0]?.id || "")
  const activeEntry = useMemo(() => {
    const activeId = selectedOrderId || entries[0]?.id || ""
    return entries.find((entry) => entry.id === activeId) || null
  }, [entries, selectedOrderId])
  const { order, isLoading, error, mergeOrder } = useGuestOrder(activeEntry)
  const { cancelOrder, isCancelling } = useGuestOrderCancellation()
  const [orderToRemove, setOrderToRemove] = useState(null)
  const [orderToContact, setOrderToContact] = useState(null)
  const [orderToChat, setOrderToChat] = useState(null)
  const [chatRefreshTick, setChatRefreshTick] = useState(0)

  const hasOrders = entries.length > 0

  const activeOrder = useMemo(() => {
    if (!order || !activeEntry || order.id !== activeEntry.id) {
      return null
    }
    return order
  }, [activeEntry, order])

  const unreadCount = useOrderChatUnreadCount({
    orderId: activeOrder?.id,
    trackingCode: activeEntry?.tracking_code,
    enabled: Boolean(activeOrder?.id && activeEntry?.tracking_code),
    refreshToken: chatRefreshTick,
  })

  const handleOrderUpdate = useCallback((payload) => {
    mergeOrder(payload)
    setEntries((current) => current.map((entry) => (
      entry.id === payload.id
        ? {
            ...entry,
            status_code: payload.status_code,
            status_name: payload.status_name,
          }
        : entry
    )))
  }, [mergeOrder])

  const handleRemoveEntry = useCallback((entry) => {
    const nextEntries = removeGuestOrder(entry.id || entry.tracking_code)
    setEntries(nextEntries)
    if (entry.id === activeEntry?.id) {
      setSelectedOrderId(nextEntries[0]?.id || "")
    }
  }, [activeEntry])

  const handleConfirmRemoval = useCallback(async (reason) => {
    if (!orderToRemove) {
      return
    }

    try {
      if (!["delivered", "cancelled"].includes(orderToRemove.status_code)) {
        const updatedOrder = await cancelOrder(orderToRemove.id, reason)
        handleOrderUpdate(updatedOrder)
        toast.success(`Pedido ${updatedOrder.order_code} cancelado`)
      } else {
        handleRemoveEntry(orderToRemove)
        toast.success("Pedido eliminado de este dispositivo")
      }
      setOrderToRemove(null)
    } catch (cancelError) {
      toast.error(cancelError.message || "No fue posible procesar la solicitud")
    }
  }, [cancelOrder, handleOrderUpdate, handleRemoveEntry, orderToRemove])

  useEffect(() => {
    if (!activeEntry?.id || !activeEntry?.tracking_code) {
      return undefined
    }

    const apiUrl = new URL(import.meta.env.VITE_API_URL || "http://localhost:8000")
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
    const query = new URLSearchParams({ tracking_code: activeEntry.tracking_code }).toString()
    const socket = new WebSocket(`${protocol}//${apiUrl.host}/api/ws/guest-orders/${activeEntry.id}/?${query}`)

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (["order.status_changed", "order.cancelled"].includes(message.event_type)) {
          handleOrderUpdate(message.payload)
          return
        }
        if (message.event_type === "order.chat_message") {
          setChatRefreshTick((current) => current + 1)
        }
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      socket.close()
    }
  }, [activeEntry?.id, activeEntry?.tracking_code, handleOrderUpdate])

  return (
    <div className="container mx-auto space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis pedidos</h1>
        <p className="mt-2 text-muted-foreground">Aqui puedes revisar los pedidos hechos sin iniciar sesion. Se conservan por 24 horas.</p>
      </div>

      {!hasOrders ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes pedidos guardados en este dispositivo.</p>
            <Button asChild className="mt-4">
              <Link to="/restaurantes">Explorar restaurantes</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hasOrders ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos guardados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedOrderId(entry.id)}
                  className={`w-full rounded-xl border p-4 text-left ${entry.id === activeEntry?.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.restaurant_name}</p>
                      <p className="text-sm text-muted-foreground">{entry.order_code}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation()
                        const matchedOrder = activeOrder?.id === entry.id
                          ? activeOrder
                          : {
                              ...entry,
                              id: entry.id,
                              status_code: entry.status_code,
                              order_code: entry.order_code,
                            }
                        setOrderToRemove(matchedOrder)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Cargando pedido...</p> : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {activeOrder ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{activeOrder.order_code}</h2>
                    <Badge>{activeOrder.status_name}</Badge>
                    <Badge variant="outline">{activeOrder.order_type_name}</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    {activeOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span>{item.quantity}x {item.item_name_snapshot}</span>
                        <span>{formatCurrency(item.line_total_amount, activeOrder.currency_code)}</span>
                      </div>
                    ))}
                  </div>
                  {activeOrder.delivery_address_label ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{activeOrder.delivery_address_label}</span>
                    </div>
                  ) : null}
                  {activeOrder.table_number ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShoppingBag className="h-4 w-4" />
                      <span>Mesa {activeOrder.table_number}</span>
                    </div>
                  ) : null}
                  {activeOrder.cancel_reason ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
                      {activeOrder.cancelled_by ? <p><strong>Cancelado por:</strong> {activeOrder.cancelled_by}</p> : null}
                      <strong>Motivo de cancelacion:</strong> {activeOrder.cancel_reason}
                    </div>
                  ) : null}
                  {activeOrder.estimated_min_minutes || activeOrder.estimated_max_minutes ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatDeliveryWindow(activeOrder.estimated_min_minutes, activeOrder.estimated_max_minutes)}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-border pt-4 text-lg font-semibold">
                    Total: <span className="text-primary">{formatCurrency(activeOrder.total_amount, activeOrder.currency_code)}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setOrderToContact(activeOrder)}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Contactar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setOrderToChat(activeOrder)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Chat
                      {unreadCount > 0 ? (
                        <Badge className="ml-2" variant="default">{unreadCount}</Badge>
                      ) : null}
                    </Button>
                    {!['delivered', 'cancelled'].includes(activeOrder.status_code) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => setOrderToRemove(activeOrder)}
                        disabled={isCancelling}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <RestaurantContactDialog
        open={Boolean(orderToContact)}
        onOpenChange={(open) => {
          if (!open) {
            setOrderToContact(null)
          }
        }}
        order={orderToContact}
        trackingCode={activeEntry?.tracking_code}
      />

      <OrderChatSheet
        open={Boolean(orderToChat)}
        onOpenChange={(open) => {
          if (!open) {
            setOrderToChat(null)
          }
        }}
        order={orderToChat}
        side="customer"
        trackingCode={activeEntry?.tracking_code}
      />

      <CancelOrderDialog
        open={Boolean(orderToRemove)}
        onOpenChange={(open) => {
          if (!open) {
            setOrderToRemove(null)
          }
        }}
        order={orderToRemove}
        isSubmitting={isCancelling}
        onConfirm={handleConfirmRemoval}
        title="Eliminar o cancelar pedido"
      />
    </div>
  )
}
