import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminReports } from "@/hooks/use-admin"
import { formatCurrency } from "@/lib/format"

export default function AdminReports() {
  const { data, isLoading, error } = useAdminReports()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reportes y analisis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reporte real de tendencia reciente, categorias con mejor volumen y mix de tipos de pedido.
        </p>
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tendencia diaria de ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.daily_trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#c2410c" fill="#fed7aa" name="Ingresos" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ordenes por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.category_performance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" stroke="#64748b" angle={-25} textAnchor="end" height={70} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#0f766e" name="Ordenes" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Tipos de pedido</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {data.order_type_distribution.map((item) => (
                  <div key={item.code} className="rounded-xl border border-border/70 p-4">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold text-foreground">{item.percentage}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.value} pedidos</p>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Insights principales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.insights.map((insight, index) => (
                  <div key={`${insight.title}-${index}`} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                    <p className="font-medium text-foreground">{insight.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Categoria</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Ordenes</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Ingresos</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Restaurantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.category_performance.map((row) => (
                      <tr key={row.category} className="border-b border-border/70 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-foreground">{row.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{row.orders}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{row.restaurants}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
