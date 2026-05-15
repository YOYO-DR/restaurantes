import { toast } from "sonner"
import { useCallback, useEffect, useState } from "react"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { OrdersListSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCart } from "@/context/cart-context"
import { realtimeClient } from "@/lib/realtime-client"
import { useCustomerOrders, useReorder } from "@/hooks/use-orders"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { Clock, Loader2, MapPin, Phone, RotateCcw, ShoppingBag } from "lucide-react"

const ACTIVE_STATUSES = ["new", "preparing", "ready"]

export default function ClientOrdersPage() {
  const { orders, isLoading, error, mergeOrder, cancelOrder, updatingOrderId } = useCustomerOrders()
  const { reorder, isReordering } = useReorder()
  const { items: cartItems, restaurant: cartRestaurant } = useCart()
  const [orderToCancel, setOrderToCancel] = useState(null)
  const [orderToReorder, setOrderToReorder] = useState(null)
  const [reorderingId, setReorderingId] = useState(null)

  const handleOrderUpdate = useCallback((payload) => {
    mergeOrder(payload)
  }, [mergeOrder])

  useEffect(() => {
    const unsubs = [
      realtimeClient.subscribe("order.status_changed", handleOrderUpdate),
      realtimeClient.subscribe("order.cancelled", handleOrderUpdate),
      realtimeClient.subscribe("order.payment_completed", handleOrderUpdate),
      realtimeClient.subscribe("order.payment_failed", handleOrderUpdate),
    ]
    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe())
    }
  }, [handleOrderUpdate])

  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status_code))
  const completedOrders = orders.filter((order) => order.status_code === "delivered")
  const cancelledOrders = orders.filter((order) => order.status_code === "cancelled")

  const handleReorder = useCallback(async (order) => {
    setReorderingId(order.id)
    try {
      await reorder(order)
    } finally {
      setReorderingId(null)
    }
  }, [reorder])

  const handleReorderClick = useCallback((order) => {
    if (cartItems.length > 0) {
      setOrderToReorder(order)
    } else {
      handleReorder(order)
    }
  }, [cartItems.length, handleReorder])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mis Pedidos</h2>
        <p className="text-muted-foreground">Historial y seguimiento de tus pedidos</p>
      </div>

      {isLoading ? <OrdersListSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Activos ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completados</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados ({cancelledOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} onReorder={handleReorderClick} reorderingId={reorderingId} updatingOrderId={updatingOrderId} />
            ))}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length ? (
              activeOrders.map((order) => <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} onReorder={handleReorderClick} reorderingId={reorderingId} updatingOrderId={updatingOrderId} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No tienes pedidos activos</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOrders.map((order) => (
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} onReorder={handleReorderClick} reorderingId={reorderingId} updatingOrderId={updatingOrderId} />
            ))}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledOrders.map((order) => (
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} onReorder={handleReorderClick} reorderingId={reorderingId} updatingOrderId={updatingOrderId} />
            ))}
          </TabsContent>
        </Tabs>
      )}

      <CancelOrderDialog
        open={Boolean(orderToCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setOrderToCancel(null)
          }
        }}
        order={orderToCancel}
        isSubmitting={Boolean(orderToCancel && updatingOrderId === orderToCancel.id)}
        onConfirm={async (reason) => {
          try {
            const updatedOrder = await cancelOrder(orderToCancel.id, reason)
            toast.success(`Pedido ${updatedOrder.order_code} cancelado`)
            setOrderToCancel(null)
          } catch (cancelError) {
            toast.error(cancelError.message || "No fue posible cancelar el pedido")
          }
        }}
        title="Cancelar pedido"
      />

      <Dialog open={Boolean(orderToReorder)} onOpenChange={(open) => { if (!open) setOrderToReorder(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reemplazar carrito actual</DialogTitle>
            <DialogDescription>
              Tu carrito tiene items de <strong>{cartRestaurant?.name}</strong>. ¿Quieres reemplazarlos para repetir el pedido de <strong>{orderToReorder?.restaurant_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderToReorder(null)} disabled={isReordering}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const order = orderToReorder
                setOrderToReorder(null)
                handleReorder(order)
              }}
              disabled={isReordering}
            >
              {isReordering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderCard({ order, onCancel, onReorder, reorderingId, updatingOrderId }) {
  const isThisReordering = reorderingId === order.id

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{order.restaurant_name}</CardTitle>
            <Badge variant={order.status_code === "delivered" ? "outline" : "default"}>{order.status_name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.order_code} - {new Date(order.created_at).toLocaleString("es-CO")}
          </p>
        </div>
        <Badge variant="outline">{order.order_type_name}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {order.customer_name ? <p className="text-sm text-muted-foreground">A nombre de {order.customer_name}</p> : null}
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.item_name_snapshot}</span>
              <span>{formatCurrency(item.line_total_amount, order.currency_code)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 font-medium">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(order.total_amount, order.currency_code)}</span>
          </div>
        </div>

        {order.estimated_min_minutes || order.estimated_max_minutes ? (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Tiempo estimado: {formatDeliveryWindow(order.estimated_min_minutes, order.estimated_max_minutes)}
            </span>
          </div>
        ) : null}

        {order.delivery_address_label ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{order.delivery_address_label}</span>
          </div>
        ) : null}

        {order.table_number ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
            <span>Mesa {order.table_number}</span>
          </div>
        ) : null}

        {order.cancel_reason ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
            {order.cancelled_by ? <p><strong>Cancelado por:</strong> {order.cancelled_by}</p> : null}
            <strong>Motivo de cancelacion:</strong> {order.cancel_reason}
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" disabled>
            <Phone className="mr-2 h-4 w-4" />
            Contactar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onReorder(order)}
            disabled={isThisReordering}
          >
            {isThisReordering
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RotateCcw className="mr-2 h-4 w-4" />}
            {isThisReordering ? "Cargando..." : "Repetir pedido"}
          </Button>
          {!["delivered", "cancelled"].includes(order.status_code) ? (
            <Button variant="destructive" size="sm" onClick={() => onCancel(order)} disabled={updatingOrderId === order.id}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
