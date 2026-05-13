import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Progress } from "@/components/ui/progress"
import { useCustomerLoyalty } from "@/hooks/use-orders"
import { Award, Gift, Star, TrendingUp } from "lucide-react"

const LEVELS = [
  { name: "Bronce", minPoints: 0, maxPoints: 500 },
  { name: "Plata", minPoints: 501, maxPoints: 1000 },
  { name: "Oro", minPoints: 1001, maxPoints: 2500 },
  { name: "Platino", minPoints: 2501, maxPoints: 5000 },
]

import { useSearchParams, Link } from "react-router-dom"

export default function ClientPointsPage() {
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get("restaurant_id")
  const { data, isLoading, error } = useCustomerLoyalty(restaurantId)
  const currentLevel = LEVELS.find((level) => level.name === data.current_level) || LEVELS[0]
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1]
  const progressToNextLevel = nextLevel
    ? ((data.current_points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Puntos</h2>
          <p className="text-muted-foreground">Acumula puntos y canjéalos por recompensas</p>
        </div>
        {restaurantId && (
          <Button variant="outline" asChild>
            <Link to="/dashboard/cliente">Volver al resumen</Link>
          </Button>
        )}
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Puntos Disponibles" value={data.current_points.toLocaleString()} icon={<Star className="h-4 w-4 text-muted-foreground" />} highlight />
            <MetricCard title="Total Acumulados" value={data.total_earned.toLocaleString()} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Nivel Actual" value={data.current_level} icon={<Award className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Recompensas Canjeadas" value={data.rewards_redeemed} icon={<Gift className="h-4 w-4 text-muted-foreground" />} />
          </div>

          {nextLevel ? (
            <Card>
              <CardContent className="py-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Progreso hacia nivel {nextLevel.name}</span>
                  <span className="text-sm text-muted-foreground">{data.current_points} / {nextLevel.minPoints} puntos</span>
                </div>
                <Progress value={progressToNextLevel} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Te faltan {nextLevel.minPoints - data.current_points} puntos para alcanzar el nivel {nextLevel.name}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recompensas Disponibles</CardTitle>
                <CardDescription>Canjea tus puntos por estas recompensas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.available_rewards.map((reward) => (
                    <div key={reward.id} className="space-y-3 rounded-lg border border-border p-4">
                      <div>
                        <h4 className="font-medium">{reward.name}</h4>
                        <p className="text-sm text-muted-foreground">{reward.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{reward.restaurant_name}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          <Star className="mr-1 h-3 w-3" />
                          {reward.points} pts
                        </Badge>
                        <Button size="sm" disabled={data.current_points < reward.points} variant={data.current_points >= reward.points ? "default" : "outline"}>
                          Canjear
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historial de Puntos</CardTitle>
                <CardDescription>Movimientos recientes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">{item.date}</p>
                      </div>
                      <span className={`font-semibold ${item.type === "redeemed" ? "text-destructive" : "text-green-600"}`}>
                        {item.points > 0 ? "+" : ""}{item.points}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
        <div className={`text-3xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
