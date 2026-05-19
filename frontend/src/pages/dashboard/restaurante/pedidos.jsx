import { toast } from "sonner"
import { useState } from "react"
import { OrderChatSheet } from "@/components/order-chat/order-chat-sheet"
import { useOperatorPermission } from "@/hooks/use-operator-permission"
import { useOrderChatUnreadCount } from "@/hooks/use-order-chat"
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog"
import { DashboardShellSkeleton, OrdersListSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useOwnerOrdersContext } from "@/context/owner-orders-context"
import { formatCurrency } from "@/lib/format"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OrderFilters } from "@/components/orders/order-filters"
import { CheckCircle, ChefHat, ChevronLeft, ChevronRight, Clock, LayoutList, List, Loader2, MapPin, MessageCircle, Phone, ShoppingBag, Truck, User, X } from "lucide-react"

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50]

function OrdersControls({ page, hasNext, hasPrev, setPage, pageSize, setPageSize, viewMode, setViewMode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "expanded" ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => setViewMode("expanded")}
          title="Vista detallada"
        >
          <LayoutList className="h-3.5 w-3.5" />
          Detallado
        </Button>
        <Button
          variant={viewMode === "compact" ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => setViewMode("compact")}
          title="Vista compacta"
        >
          <List className="h-3.5 w-3.5" />
          Compacto
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(hasNext || hasPrev) ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!hasPrev} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Pág. {page}</span>
            <Button variant="outline" size="sm" className="h-8" disabled={!hasNext} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function OwnerOrdersPage() {
  const { orders, isLoading, isPageLoading, error, updateStatus, cancelOrder, updatingOrderId, page, hasNext, hasPrev, setPage, pageSize, setPageSize, filters, setFilters } = useOwnerOrdersContext()
  const [orderToCancel, setOrderToCancel] = useState(null)
  const [orderToChat, setOrderToChat] = useState(null)
  const [viewMode, setViewMode] = useState("expanded")
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

            <OrderFilters filters={filters} setFilters={setFilters} variant="owner" />

            <OrdersControls
              page={page} hasNext={hasNext} hasPrev={hasPrev} setPage={setPage}
              pageSize={pageSize} setPageSize={setPageSize}
              viewMode={viewMode} setViewMode={setViewMode}
            />

            <TabsContent value="all" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : orders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
              ))}
            </TabsContent>
            <TabsContent value="new" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : newOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
              ))}
            </TabsContent>
            <TabsContent value="preparing" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : preparingOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
              ))}
            </TabsContent>
            <TabsContent value="ready" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : readyOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
              ))}
            </TabsContent>
            <TabsContent value="completed" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : completedOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
              ))}
            </TabsContent>
            <TabsContent value="cancelled" className="space-y-2">
              {isPageLoading ? <OrdersListSkeleton /> : cancelledOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={updateStatus} onCancel={setOrderToCancel} onChat={setOrderToChat} updatingOrderId={updatingOrderId} compact={viewMode === "compact"} />
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

          <OrderChatSheet
            open={Boolean(orderToChat)}
            onOpenChange={(open) => {
              if (!open) {
                setOrderToChat(null)
              }
            }}
            order={orderToChat}
            side="restaurant"
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

function OrderCard({ order, onStatusChange, onCancel, onChat, updatingOrderId, compact = false }) {
  const { canEdit } = useOperatorPermission("pedidos")
  const unreadCount = useOrderChatUnreadCount({ orderId: order.id })
  const nextStatus = order.status_code === "new"
    ? { code: "preparing", label: "Preparar", icon: <ChefHat className="h-4 w-4" /> }
    : order.status_code === "preparing"
      ? { code: "ready", label: "Listo", icon: <CheckCircle className="h-4 w-4" /> }
      : order.status_code === "ready"
        ? { code: "delivered", label: "Entregado", icon: <Truck className="h-4 w-4" /> }
        : null

  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm ${order.status_code === "new" ? "border-primary" : "border-border"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{order.order_code}</span>
            <Badge variant={order.status_code === "delivered" ? "outline" : "default"} className="text-xs">{order.status_name}</Badge>
            <Badge variant="outline" className="text-xs">{order.order_type_name}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {order.customer_name} · {order.items.length} prod. · {new Date(order.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className="shrink-0 font-bold text-primary">{formatCurrency(order.total_amount, order.currency_code)}</span>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && nextStatus ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2 text-xs"
              disabled={updatingOrderId === order.id}
              onClick={async () => {
                try {
                  await onStatusChange(order.id, nextStatus.code)
                } catch (e) {
                  toast.error(e.message || "Error al actualizar")
                }
              }}
              title={nextStatus.label}
            >
              {updatingOrderId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : nextStatus.icon}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => onChat(order)} title="Chat">
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unreadCount}</span> : null}
          </Button>
          {!["delivered", "cancelled"].includes(order.status_code) ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onCancel(order)} disabled={updatingOrderId === order.id} title="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

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
          <Button variant="outline" onClick={() => onChat(order)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat
            {unreadCount > 0 ? (
              <Badge className="ml-2" variant="default">{unreadCount}</Badge>
            ) : null}
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
