import { useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCustomerDashboard } from "@/hooks/use-orders"
import { formatCurrency } from "@/lib/format"
import { ArrowRight, Clock, ShoppingBag, Star, Utensils } from "lucide-react"

export default function ClientDashboardPage() {
  const [orderScope, setOrderScope] = useState("all")
  const { data, isLoading, error } = useCustomerDashboard(orderScope)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Hola, {data.user_name || ""}!</h2>
        <div className="space-y-2">
          <p className="text-muted-foreground">Bienvenido a tu cuenta de FoodHub</p>
          <Select value={orderScope} onValueChange={(value) => setOrderScope(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las ordenes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ordenes</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="non_completed">No finalizadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Pedidos" value={data.metrics.total_orders} icon={<ShoppingBag className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Puntos Acumulados" value={data.metrics.points} icon={<Star className="h-4 w-4 text-muted-foreground" />} highlight />
            <MetricCard title="Restaurantes Favoritos" value={data.metrics.favorite_restaurants_count} icon={<Utensils className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Tiempo Promedio" value={`${data.metrics.average_delivery_time} min`} icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Recientes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard/cliente/pedidos">
                    Ver todos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recent_orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="space-y-1">
                        <p className="font-medium">{order.restaurant_name}</p>
                        <p className="text-sm text-muted-foreground">{order.items.map((item) => item.item_name_snapshot).join(", ")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("es-CO")}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={order.status_code === "delivered" ? "secondary" : "default"}>{order.status_name}</Badge>
                        <p className="mt-1 font-medium">{formatCurrency(order.total_amount, order.currency_code)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Restaurantes Favoritos</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard/cliente/favoritos">
                    Ver todos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.favorite_restaurants.map((restaurant) => (
                    <div key={restaurant.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <span className="text-lg font-bold text-primary">{restaurant.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{restaurant.name}</p>
                          <p className="text-sm text-muted-foreground">{restaurant.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{restaurant.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold tracking-tight">Tus Puntos de Fidelidad</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="flex h-full flex-col items-start justify-between gap-4 p-6">
                  <div>
                    <h4 className="text-sm font-medium text-primary-foreground/80">Puntos Totales</h4>
                    <div className="mt-2 text-3xl font-bold">{data.loyalty.points}</div>
                    <p className="mt-1 text-sm text-primary-foreground/80">Acumulados en todos los restaurantes</p>
                  </div>
                </CardContent>
              </Card>

              {data.loyalty.accounts?.map((account) => (
                <Card key={account.restaurant_id}>
                  <CardContent className="flex h-full flex-col items-start justify-between gap-4 p-6">
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold line-clamp-1 pr-2">{account.restaurant_name}</h4>
                        <Badge variant="secondary">{account.tier}</Badge>
                      </div>
                      <div className="mt-2 text-2xl font-bold text-primary">
                        {account.points} <span className="text-sm font-normal text-muted-foreground">pts</span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to={`/dashboard/cliente/puntos?restaurant_id=${account.restaurant_id}`}>
                        Ver historial
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {(!data.loyalty.accounts || data.loyalty.accounts.length === 0) && (
                <Card className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center justify-center border-dashed p-6 text-muted-foreground">
                  Aún no tienes puntos en ningún restaurante.
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon, highlight = false }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
