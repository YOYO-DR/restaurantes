import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { useOwnerAnalytics } from "@/hooks/use-orders"
import { formatCurrency } from "@/lib/format"
import { DollarSign, ShoppingBag, TrendingUp, Users } from "lucide-react"

const PERIODS = ["today", "week", "month", "year"]
const PERIOD_LABELS = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este ano",
}

export default function OwnerAnalyticsPage() {
  const [orderScope, setOrderScope] = useState("all")
  const { data, isLoading, error } = useOwnerAnalytics(orderScope)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Analiticas</h2>
        <div className="space-y-2">
          <p className="text-muted-foreground">Metricas y estadisticas de tu restaurante</p>
          <select
            value={orderScope}
            onChange={(event) => setOrderScope(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todas las ordenes</option>
            <option value="completed">Completadas</option>
            <option value="non_completed">No finalizadas</option>
          </select>
        </div>
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <Tabs defaultValue="today" className="space-y-6">
            <TabsList>
              {PERIODS.map((period) => (
                <TabsTrigger key={period} value={period}>{PERIOD_LABELS[period]}</TabsTrigger>
              ))}
            </TabsList>

            {PERIODS.map((period) => {
              const sales = data.sales[period] || { value: 0, orders: 0, new_customers: 0, average_ticket: 0 }
              return (
                <TabsContent key={period} value={period} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard title="Ventas Totales" value={formatCurrency(sales.value)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
                    <MetricCard title="Pedidos" value={sales.orders} icon={<ShoppingBag className="h-4 w-4 text-muted-foreground" />} />
                    <MetricCard title="Clientes Nuevos" value={sales.new_customers} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                    <MetricCard title="Ticket Promedio" value={formatCurrency(sales.average_ticket)} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos por Hora (Hoy)</CardTitle>
                <CardDescription>Distribucion de pedidos durante el dia</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.hourly_data.map((entry) => {
                    const maxOrders = Math.max(...data.hourly_data.map((item) => item.orders), 1)
                    return (
                      <div key={entry.hour} className="flex items-center gap-4">
                        <span className="w-12 text-sm text-muted-foreground">{entry.hour}</span>
                        <div className="flex-1">
                          <div className="h-8 rounded bg-primary/80 transition-all" style={{ width: `${(entry.orders / maxOrders) * 100}%` }} />
                        </div>
                        <span className="w-8 text-sm font-medium">{entry.orders}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productos Mas Vendidos</CardTitle>
                <CardDescription>Top 5 productos del restaurante</CardDescription>
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
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricStat label="Clientes Totales" value={data.customer_metrics.total_customers} />
            <MetricStat label="Nuevos Este Mes" value={data.customer_metrics.new_this_month} highlight />
            <MetricStat label="Tasa de Retorno" value={`${data.customer_metrics.returning}%`} />
            <MetricStat label="Ticket Promedio" value={formatCurrency(data.customer_metrics.average_ticket)} />
          </div>
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

function MetricStat({ label, value, highlight = false }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <p className={`text-3xl font-bold ${highlight ? "text-green-600" : ""}`}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
