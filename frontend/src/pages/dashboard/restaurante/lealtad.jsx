import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  useOwnerLoyaltyRedemptions,
  useOwnerLoyaltyRewards,
  useOwnerLoyaltySetting,
  useOwnerLoyaltyTiers,
} from "@/hooks/use-loyalty"
import { useOwnerRestaurants } from "@/hooks/use-restaurants"

export default function OwnerLoyaltyPage() {
  const { restaurants } = useOwnerRestaurants()
  const restaurant = restaurants[0]
  const restaurantId = restaurant?.id

  const { data: setting, save: saveSetting, isLoading: settingLoading } = useOwnerLoyaltySetting(restaurantId)
  const { tiers, create: createTier, update: updateTier, remove: removeTier } = useOwnerLoyaltyTiers(restaurantId)
  const { rewards, create: createReward, update: updateReward, remove: removeReward } = useOwnerLoyaltyRewards(restaurantId)
  const { redemptions } = useOwnerLoyaltyRedemptions(restaurantId)

  const [draftSetting, setDraftSetting] = useState(null)

  const settingState = useMemo(() => draftSetting || setting || {
    is_active: false,
    currency_unit_amount: "1000.00",
    points_earned: 1,
    max_points_per_order: "",
    max_redeemable_points_per_order: "",
    vip_threshold_orders: 100,
    point_redeem_value: "",
  }, [draftSetting, setting])

  if (!restaurantId) {
    return <div className="text-sm text-muted-foreground">No se encontro restaurante para gestionar lealtad.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lealtad</h1>
        <p className="text-muted-foreground">Configura puntos, niveles, recompensas y revisa canjes.</p>
      </div>

      <Tabs defaultValue="configuracion" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuracion">Configuracion</TabsTrigger>
          <TabsTrigger value="tiers">Niveles</TabsTrigger>
          <TabsTrigger value="rewards">Recompensas</TabsTrigger>
          <TabsTrigger value="redemptions">Canjes</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracion">
          <Card>
            <CardHeader>
              <CardTitle>Configuracion del programa</CardTitle>
              <CardDescription>Define equivalencias y topes de tu programa de puntos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Programa activo</p>
                  <p className="text-sm text-muted-foreground">Si esta apagado, no se acumulan ni canjean puntos.</p>
                </div>
                <Switch
                  checked={Boolean(settingState.is_active)}
                  onCheckedChange={(checked) => setDraftSetting((current) => ({ ...(current || settingState), is_active: checked }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Pesos por unidad" value={settingState.currency_unit_amount} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), currency_unit_amount: value }))} />
                <Field label="Puntos ganados" type="number" value={settingState.points_earned} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), points_earned: Number(value || 0) }))} />
                <Field label="Tope puntos por orden" type="number" value={settingState.max_points_per_order ?? ""} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), max_points_per_order: value || null }))} />
                <Field label="Tope canje por orden" type="number" value={settingState.max_redeemable_points_per_order ?? ""} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), max_redeemable_points_per_order: value || null }))} />
                <Field label="VIP por pedidos completados" type="number" value={settingState.vip_threshold_orders} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), vip_threshold_orders: Number(value || 100) }))} />
                <Field label="Valor de canje por punto" value={settingState.point_redeem_value ?? ""} onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), point_redeem_value: value || null }))} />
              </div>

              <p className="text-sm text-muted-foreground">
                Por cada ${Number(settingState.currency_unit_amount || 0).toLocaleString()} tus clientes ganan {settingState.points_earned || 0} punto(s).
              </p>

              <Button
                disabled={settingLoading}
                onClick={async () => {
                  try {
                    await saveSetting(draftSetting || settingState)
                    setDraftSetting(null)
                    toast.success("Configuracion de lealtad actualizada")
                  } catch (error) {
                    toast.error(error.message || "No fue posible guardar la configuracion")
                  }
                }}
              >
                Guardar cambios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers">
          <Card>
            <CardHeader>
              <CardTitle>Niveles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.map((tier) => (
                <div key={tier.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-5">
                  <Input value={tier.name} onChange={(event) => updateTier(tier.id, { name: event.target.value })} />
                  <Input value={tier.code} onChange={(event) => updateTier(tier.id, { code: event.target.value })} />
                  <Input type="number" value={tier.min_points} onChange={(event) => updateTier(tier.id, { min_points: Number(event.target.value || 0) })} />
                  <Input type="number" value={tier.max_points ?? ""} onChange={(event) => updateTier(tier.id, { max_points: event.target.value ? Number(event.target.value) : null })} />
                  <Button variant="destructive" onClick={() => removeTier(tier.id)}>Eliminar</Button>
                </div>
              ))}
              <Button onClick={() => createTier({ restaurant: restaurantId, code: `tier_${Date.now()}`, name: "Nuevo nivel", min_points: 0, max_points: null })}>
                Agregar nivel
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle>Recompensas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rewards.map((reward) => (
                <div key={reward.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-7">
                  <Input value={reward.name} onChange={(event) => updateReward(reward.id, { name: event.target.value })} />
                  <Input type="number" value={reward.points_cost} onChange={(event) => updateReward(reward.id, { points_cost: Number(event.target.value || 0) })} />
                  <Input type="number" value={reward.available_quantity ?? ""} onChange={(event) => updateReward(reward.id, { available_quantity: event.target.value ? Number(event.target.value) : null })} />
                  <Input type="number" value={reward.max_per_user ?? ""} onChange={(event) => updateReward(reward.id, { max_per_user: event.target.value ? Number(event.target.value) : null })} />
                  <Input type="date" value={reward.valid_until ?? ""} onChange={(event) => updateReward(reward.id, { valid_until: event.target.value || null })} />
                  <div className="flex items-center gap-2">
                    <Label>Activa</Label>
                    <Switch checked={reward.is_active} onCheckedChange={(checked) => updateReward(reward.id, { is_active: checked })} />
                  </div>
                  <Button variant="destructive" onClick={() => removeReward(reward.id)}>Eliminar</Button>
                </div>
              ))}
              <Button onClick={() => createReward({ restaurant: restaurantId, name: "Nueva recompensa", description: "", points_cost: 100, is_active: true })}>
                Agregar recompensa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions">
          <Card>
            <CardHeader>
              <CardTitle>Canjes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {redemptions.map((redemption) => (
                  <div key={redemption.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-5">
                    <span>{redemption.customer_name}</span>
                    <span>{redemption.reward_name}</span>
                    <span>{redemption.status_code}</span>
                    <span>{redemption.order || "Sin orden"}</span>
                    <span>{new Date(redemption.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
