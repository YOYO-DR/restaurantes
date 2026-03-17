import { toast } from "sonner"
import { useCallback, useState } from "react"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { OrdersListSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/auth-context"
import { useUserOrderNotifications } from "@/hooks/use-owner-order-notifications"
import { useCustomerOrders } from "@/hooks/use-orders"
import { formatCurrency, formatDeliveryWindow } from "@/lib/format"
import { Clock, MapPin, Phone, RotateCcw, ShoppingBag } from "lucide-react"

const ACTIVE_STATUSES = ["new", "preparing", "ready"]

export default function ClientOrdersPage() {
  const { user } = useAuth()
  const { orders, isLoading, error, mergeOrder, cancelOrder, updatingOrderId } = useCustomerOrders()
  const [orderToCancel, setOrderToCancel] = useState(null)
  const handleOrderUpdate = useCallback((payload) => {
    mergeOrder(payload)
  }, [mergeOrder])
  useUserOrderNotifications(user?.id, handleOrderUpdate)

  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status_code))
  const completedOrders = orders.filter((order) => order.status_code === "delivered")
  const cancelledOrders = orders.filter((order) => order.status_code === "cancelled")

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
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
            ))}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length ? (
              activeOrders.map((order) => <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No tienes pedidos activos</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOrders.map((order) => (
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
            ))}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledOrders.map((order) => (
              <OrderCard key={order.id} order={order} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
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
    </div>
  )
}

function OrderCard({ order, onCancel, updatingOrderId }) {
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
          <Button variant="outline" size="sm" className="flex-1" disabled>
            <RotateCcw className="mr-2 h-4 w-4" />
            Repetir pedido
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
