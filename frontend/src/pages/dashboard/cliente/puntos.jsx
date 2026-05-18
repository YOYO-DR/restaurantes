import { Link } from "react-router-dom"
import { useSearchParams } from "react-router-dom"
import { Award, Gift, Star, TrendingUp } from "lucide-react"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useCancelRedemption, useCustomerRedemptions, useRedeemReward } from "@/hooks/use-loyalty"
import { useCustomerLoyalty } from "@/hooks/use-orders"

export default function ClientPointsPage() {
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get("restaurant_id")
  const { data, isLoading, error, reload } = useCustomerLoyalty(restaurantId)
  const { redeem, isSubmitting } = useRedeemReward()
  const { cancel, isSubmitting: isCancelling } = useCancelRedemption()
  const { redemptions: pendingRedemptions, reload: reloadPending } = useCustomerRedemptions("pending", true)

  const selectedRestaurantSummary = restaurantId
    ? data.points_by_restaurant?.find((entry) => entry.restaurant_id === restaurantId) || null
    : null
  const levelForProgress = selectedRestaurantSummary?.current_level || data.current_level
  const pointsForProgress = selectedRestaurantSummary?.current_points ?? data.current_points
  const currentTierIndex = data.tiers.findIndex((tier) => tier.name === levelForProgress)
  const currentTier = currentTierIndex >= 0 ? data.tiers[currentTierIndex] : data.tiers[0]
  const nextTier = currentTierIndex >= 0 ? data.tiers[currentTierIndex + 1] : null
  const progressToNextLevel = nextTier
    ? ((pointsForProgress - currentTier.min_points) / (nextTier.min_points - currentTier.min_points)) * 100
    : 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Puntos</h2>
          <p className="text-muted-foreground">Acumula puntos y canjealos por recompensas</p>
        </div>
        {restaurantId ? (
          <Button variant="outline" asChild>
            <Link to="/dashboard/cliente">Volver al resumen</Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {!isLoading && restaurantId && !data.is_active ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Este restaurante no participa en el programa de puntos.
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? null : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Puntos Disponibles" value={data.current_points.toLocaleString()} icon={<Star className="h-4 w-4 text-muted-foreground" />} highlight />
            <MetricCard title="Total Acumulados" value={data.total_earned.toLocaleString()} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Nivel Actual" value={levelForProgress} icon={<Award className="h-4 w-4 text-muted-foreground" />} />
            <MetricCard title="Recompensas Canjeadas" value={data.rewards_redeemed} icon={<Gift className="h-4 w-4 text-muted-foreground" />} />
          </div>

          {!restaurantId && data.points_by_restaurant.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Puntos por restaurante</CardTitle>
                <CardDescription>Selecciona uno para ver su progreso de nivel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.points_by_restaurant.map((entry) => (
                    <div key={entry.restaurant_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium">{entry.restaurant_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Nivel {entry.current_level} - {entry.current_points.toLocaleString()} pts
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/dashboard/cliente/puntos?restaurant_id=${entry.restaurant_id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : levelForProgress === "Varios" ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Tienes cuentas de puntos en varios restaurantes. Selecciona un restaurante para ver tu progreso por nivel.
              </CardContent>
            </Card>
          ) : nextTier ? (
            <Card>
              <CardContent className="py-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Progreso hacia nivel {nextTier.name}</span>
                  <span className="text-sm text-muted-foreground">{pointsForProgress} / {nextTier.min_points} puntos</span>
                </div>
                <Progress value={Math.max(0, Math.min(progressToNextLevel, 100))} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Te faltan {Math.max(nextTier.min_points - pointsForProgress, 0)} puntos para alcanzar el nivel {nextTier.name}
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
                        <Button
                          size="sm"
                          disabled={isSubmitting || data.current_points < reward.points}
                          variant={data.current_points >= reward.points ? "default" : "outline"}
                          onClick={async () => {
                            if (!window.confirm(`Vas a canjear ${reward.points} puntos por '${reward.name}'. Deseas continuar?`)) {
                              return
                            }
                            try {
                              await redeem({ reward_id: reward.id })
                              await reload()
                              await reloadPending()
                            } catch {
                              // handled by api layer toasts if any
                            }
                          }}
                        >
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
                        {item.points > 0 ? "+" : ""}
                        {item.points}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mis canjes pendientes</CardTitle>
                <CardDescription>Usalos en tu siguiente compra o cancelalos para recuperar puntos.</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRedemptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tienes canjes pendientes.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingRedemptions.map((redemption) => (
                      <div key={redemption.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{redemption.reward_name}</p>
                            <p className="text-sm text-muted-foreground">{redemption.restaurant_name} - {redemption.points_available} pts reservados</p>
                          </div>
                          <Badge variant="outline">{redemption.status_code}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/restaurantes/${redemption.restaurant_slug}`}>Aplicar en mi proximo pedido</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isCancelling}
                            onClick={async () => {
                              try {
                                await cancel(redemption.id)
                                await reload()
                                await reloadPending()
                              } catch {
                                // handled by api layer toasts if any
                              }
                            }}
                          >
                            Cancelar canje
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
