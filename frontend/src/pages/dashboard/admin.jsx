import { useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  ArrowRight,
  DollarSign,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminDashboard } from "@/hooks/use-admin"
import { formatCurrency } from "@/lib/format"

const PIE_COLORS = ["#c2410c", "#0f766e", "#0f4c81", "#b45309", "#7c2d12", "#475569"]

export default function AdminDashboard() {
  const [orderScope, setOrderScope] = useState("all")
  const { data, isLoading, error } = useAdminDashboard(orderScope)

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">No hay datos administrativos disponibles.</div>
  }

  const metricCards = [
    {
      title: "Total usuarios",
      value: data.metrics.total_users,
      growth: data.metrics.users_growth,
      icon: Users,
      accent: "bg-sky-100 text-sky-700",
    },
    {
      title: "Restaurantes activos",
      value: data.metrics.active_restaurants,
      growth: data.metrics.restaurants_growth,
      icon: Store,
      accent: "bg-amber-100 text-amber-700",
    },
    {
      title: "Total ordenes",
      value: data.metrics.total_orders,
      growth: data.metrics.orders_growth,
      icon: ShoppingCart,
      accent: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Ingresos totales",
      value: formatCurrency(data.metrics.total_revenue),
      growth: data.metrics.revenue_growth,
      icon: DollarSign,
      accent: "bg-rose-100 text-rose-700",
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Panel de administracion</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Este dashboard ya puede construirse con los modelos actuales. Usa usuarios, restaurantes,
            pedidos y resenas reales para mostrar salud operativa y crecimiento de la plataforma.
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
          <Button variant="outline" asChild>
            <Link to="/dashboard/admin/restaurantes">Ver restaurantes</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/admin/usuarios">
              Gestionar usuarios
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon
          const positive = metric.growth >= 0
          return (
            <Card key={metric.title} className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                    <p className="mt-3 text-3xl font-bold text-foreground">{metric.value}</p>
                    <p className={`mt-2 text-xs font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}>
                      {positive ? "+" : ""}{metric.growth}% vs. periodo anterior
                    </p>
                  </div>
                  <div className={`rounded-2xl p-3 ${metric.accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos y ordenes de los ultimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.monthly_performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Ingresos" stroke="#c2410c" strokeWidth={2.5} />
                <Line yAxisId="right" type="monotone" dataKey="orders" name="Ordenes" stroke="#0f766e" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurantes por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.category_distribution} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                  {data.category_distribution.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {data.category_distribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Restaurantes con mejor desempeno reciente</CardTitle>
            <Badge variant="secondary">Ultimos 30 dias</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.top_restaurants.length > 0 ? (
                data.top_restaurants.map((restaurant, index) => (
                  <div key={restaurant.id} className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{restaurant.name}</p>
                        <p className="text-sm text-muted-foreground">{restaurant.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatCurrency(restaurant.revenue)}</p>
                      <p className="text-sm text-muted-foreground">{restaurant.orders} ordenes</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aun no hay restaurantes con ventas en el periodo analizado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribucion de cuentas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.role_distribution.map((item) => (
              <div key={item.code}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min((item.count / Math.max(data.metrics.total_users, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alertas operativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className={`rounded-xl border p-4 ${
                  alert.severity === "high"
                    ? "border-red-200 bg-red-50"
                    : alert.severity === "medium"
                      ? "border-amber-200 bg-amber-50"
                      : alert.severity === "low"
                        ? "border-sky-200 bg-sky-50"
                        : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-current" />
                  <div>
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salud operativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <OperationalMetric
              label="Pedidos demorados"
              value={data.operational_metrics.delayed_orders}
              helper="Pedidos abiertos con mas de 2 horas"
            />
            <OperationalMetric
              label="Resenas sin respuesta"
              value={data.operational_metrics.pending_review_replies}
              helper="Reviews pendientes de gestion por los restaurantes"
            />
            <OperationalMetric
              label="Restaurantes sin menu"
              value={data.operational_metrics.restaurants_without_menu}
              helper="Cuentas activas que aun no pueden vender"
            />
            <OperationalMetric
              label="Ticket promedio"
              value={formatCurrency(data.operational_metrics.average_order_value)}
              helper="Valor medio por orden en la plataforma"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OperationalMetric({ label, value, helper }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}
