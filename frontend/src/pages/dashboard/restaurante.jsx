import { useState } from "react"
import { Link } from "react-router-dom"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useOwnerRestaurantDashboard } from "@/hooks/use-restaurants"
import { formatCurrency } from "@/lib/format"
import { ArrowRight, Clock, DollarSign, ShoppingBag, Star, TrendingUp, Users } from "lucide-react"

export default function OwnerDashboardPage() {
  const [orderScope, setOrderScope] = useState("all")
  const { data, isLoading, error } = useOwnerRestaurantDashboard(orderScope)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Resumen de tu restaurante {data.restaurant?.name || ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={orderScope}
            onChange={(event) => setOrderScope(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todas las ordenes</option>
            <option value="completed">Completadas</option>
            <option value="non_completed">No finalizadas</option>
          </select>
          <Button asChild>
            <Link to="/dashboard/restaurante/pedidos">
              Ver todos los pedidos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Ventas Hoy" value={formatCurrency(data.metrics.sales_today)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Pedidos Hoy" value={data.metrics.orders_today} icon={<ShoppingBag className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Clientes de la Semana" value={data.metrics.new_customers_this_week} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Calificacion</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold">{data.restaurant?.average_rating || "0.00"}</span>
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-xs text-muted-foreground">{data.restaurant?.total_reviews || 0} resenas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Recientes</CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {data.metrics.new_orders_count} nuevos
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recent_orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{order.order_code}</p>
                          <Badge variant={order.status_name === "Nuevo" ? "default" : order.status_name === "Preparando" ? "secondary" : "outline"}>
                            {order.status_name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{order.items.join(", ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{formatCurrency(order.total_amount, order.currency_code)}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {order.order_type_name}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productos Mas Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.top_products.map((product, index) => (
                    <div key={`${product.name}-${index}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.orders} pedidos</p>
                        </div>
                      </div>
                      <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-primary to-primary/80">
            <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
              <div className="text-primary-foreground">
                <h3 className="text-lg font-semibold">Ventas de este mes</h3>
                <p className="text-3xl font-bold">{formatCurrency(data.metrics.monthly_sales)}</p>
                <div className="mt-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Resumen mensual de ingresos del restaurante</span>
                </div>
              </div>
              <Button variant="secondary" asChild>
                <Link to="/dashboard/restaurante/analiticas">Ver analiticas completas</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
