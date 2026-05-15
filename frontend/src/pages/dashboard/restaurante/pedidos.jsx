import { toast } from "sonner"
import { useState } from "react"
import { useOperatorPermission } from "@/hooks/use-operator-permission"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { DashboardShellSkeleton, OrdersListSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useOwnerOrdersContext } from "@/context/owner-orders-context"
import { formatCurrency } from "@/lib/format"
import { CheckCircle, ChefHat, Clock, Loader2, MapPin, Phone, ShoppingBag, Truck, User } from "lucide-react"

export default function OwnerOrdersPage() {
  const { orders, isLoading, error, updateStatus, cancelOrder, updatingOrderId } = useOwnerOrdersContext()
  const [orderToCancel, setOrderToCancel] = useState(null)
  const newOrders = orders.filter((order) => order.status_code === "new")
  const preparingOrders = orders.filter((order) => order.status_code === "preparing")
  const readyOrders = orders.filter((order) => order.status_code === "ready")
  const completedOrders = orders.filter((order) => order.status_code === "delivered")
  const cancelledOrders = orders.filter((order) => order.status_code === "cancelled")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pedidos</h2>
          <p className="text-muted-foreground">Gestiona los pedidos de tu restaurante</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {newOrders.length} nuevos
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <>
          <DashboardShellSkeleton />
          <OrdersListSkeleton />
        </>
      ) : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusMetric label="Nuevos" total={newOrders.length} icon={<ShoppingBag className="h-8 w-8 text-primary" />} highlight />
            <StatusMetric label="Preparando" total={preparingOrders.length} icon={<ChefHat className="h-8 w-8 text-muted-foreground" />} />
            <StatusMetric label="Listos" total={readyOrders.length} icon={<Truck className="h-8 w-8 text-muted-foreground" />} />
            <StatusMetric label="Completados" total={completedOrders.length} icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />} />
            <StatusMetric label="Cancelados" total={cancelledOrders.length} icon={<Clock className="h-8 w-8 text-muted-foreground" />} />
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="new">Nuevos ({newOrders.length})</TabsTrigger>
              <TabsTrigger value="preparing">Preparando ({preparingOrders.length})</TabsTrigger>
              <TabsTrigger value="ready">Listos ({readyOrders.length})</TabsTrigger>
              <TabsTrigger value="completed">Completados ({completedOrders.length})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelados ({cancelledOrders.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
            <TabsContent value="new" className="space-y-4">
              {newOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
            <TabsContent value="preparing" className="space-y-4">
              {preparingOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
            <TabsContent value="ready" className="space-y-4">
              {readyOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
            <TabsContent value="completed" className="space-y-4">
              {completedOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
            <TabsContent value="cancelled" className="space-y-4">
              {cancelledOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} updatingOrderId={updatingOrderId} />
              ))}
            </TabsContent>
          </Tabs>

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
            reasonPlaceholder="Ejemplo: ingrediente agotado, pedido duplicado, cliente solicito cancelacion"
          />
        </>
      )}
    </div>
  )
}

function StatusMetric({ label, total, icon, highlight = false }) {
  return (
    <Card className={highlight ? "border-primary bg-primary/5" : ""}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  )
}

function OrderCard({ order, onStatusChange, onCancel, updatingOrderId }) {
  const { canEdit } = useOperatorPermission("pedidos")
  const nextStatus = order.status_code === "new"
    ? { code: "preparing", label: "Empezar a preparar", icon: <ChefHat className="mr-2 h-4 w-4" /> }
    : order.status_code === "preparing"
      ? { code: "ready", label: "Marcar como listo", icon: <CheckCircle className="mr-2 h-4 w-4" /> }
      : order.status_code === "ready"
        ? { code: "delivered", label: "Marcar como entregado", icon: <Truck className="mr-2 h-4 w-4" /> }
        : null

  return (
    <Card className={order.status_code === "new" ? "border-primary" : ""}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{order.order_code}</CardTitle>
            <Badge variant={order.status_code === "delivered" ? "outline" : "default"}>{order.status_name}</Badge>
            <Badge variant="outline">{order.order_type_name}</Badge>
          </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {order.customer_name || order.restaurant_name}
              </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(order.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        <p className="text-xl font-bold text-primary">{formatCurrency(order.total_amount, order.currency_code)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.item_name_snapshot}</span>
                <span>{formatCurrency(item.line_total_amount, order.currency_code)}</span>
              </div>
            ))}
          </div>
          {order.customer_notes ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground"><strong>Notas:</strong> {order.customer_notes}</p>
            </div>
          ) : null}
        </div>

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

        {order.customer_phone ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{order.customer_phone}</span>
          </div>
        ) : null}

        {order.cancel_reason ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
            {order.cancelled_by ? <p><strong>Cancelado por:</strong> {order.cancelled_by}</p> : null}
            <strong>Motivo de cancelacion:</strong> {order.cancel_reason}
          </div>
        ) : null}

        <div className="flex gap-3">
          {canEdit && nextStatus ? (
            <Button
              className="flex-1"
              disabled={updatingOrderId === order.id}
              onClick={async () => {
                try {
                  await onStatusChange(order.id, nextStatus.code)
                  toast.success(`Pedido ${order.order_code} actualizado a ${nextStatus.label.toLowerCase()}`)
                } catch (statusError) {
                  toast.error(statusError.message || "No fue posible actualizar el pedido")
                }
              }}
            >
              {updatingOrderId === order.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  {nextStatus.icon}
                  {nextStatus.label}
                </>
              )}
            </Button>
          ) : null}
          <Button variant="outline" disabled>
            <Phone className="mr-2 h-4 w-4" />
            Llamar
          </Button>
          {canEdit && !["delivered", "cancelled"].includes(order.status_code) ? (
            <Button variant="destructive" onClick={() => onCancel(order)} disabled={updatingOrderId === order.id}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
