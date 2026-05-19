import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { InfoHint } from "@/components/ui/info-hint"
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

  const { data: setting, save: saveSetting, isLoading: settingLoading, isSaving } = useOwnerLoyaltySetting(restaurantId)
  const tierApi = useOwnerLoyaltyTiers(restaurantId)
  const rewardApi = useOwnerLoyaltyRewards(restaurantId)
  const { redemptions } = useOwnerLoyaltyRedemptions(restaurantId)

  const [draftSetting, setDraftSetting] = useState(null)

  const settingState = useMemo(() => draftSetting || setting || {
    is_active: false,
    max_customer_points_balance: "",
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
                <FieldWithHint
                  label="Tope maximo de puntos por cliente"
                  type="number"
                  value={settingState.max_customer_points_balance ?? ""}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), max_customer_points_balance: value ? Number(value) : null }))}
                  hint="Maximo de puntos que un cliente puede acumular en tu restaurante. Cuando llega a este tope, no recibe mas puntos hasta que canjee. Obligatorio al activar el programa."
                />
                <FieldWithHint
                  label="Pesos por unidad"
                  value={settingState.currency_unit_amount}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), currency_unit_amount: value }))}
                  hint="Es el monto en pesos que equivale a una unidad de gasto. Ejemplo: con 1000, cada $1000 genera una unidad base."
                />
                <FieldWithHint
                  label="Puntos ganados"
                  type="number"
                  value={settingState.points_earned}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), points_earned: Number(value || 0) }))}
                  hint="Cuantos puntos da cada unidad gastada. Ejemplo: si pones 2 y la unidad son $1000, un pedido de $25000 da 50 puntos."
                />
                <FieldWithHint
                  label="Tope puntos por orden"
                  type="number"
                  value={settingState.max_points_per_order ?? ""}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), max_points_per_order: value || null }))}
                  hint="Maximo de puntos que un cliente puede ganar en un solo pedido. Vacio = sin tope."
                />
                <FieldWithHint
                  label="Tope canje por orden"
                  type="number"
                  value={settingState.max_redeemable_points_per_order ?? ""}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), max_redeemable_points_per_order: value || null }))}
                  hint="Maximo de puntos que un cliente puede gastar en un pedido. Vacio = sin tope."
                />
                <FieldWithHint
                  label="VIP por pedidos completados"
                  type="number"
                  value={settingState.vip_threshold_orders}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), vip_threshold_orders: Number(value || 100) }))}
                  hint="Cantidad de pedidos para marcar cliente VIP. Por ahora es informativo y no cambia el calculo de puntos."
                />
                <FieldWithHint
                  label="Valor de canje por punto"
                  value={settingState.point_redeem_value ?? ""}
                  onChange={(value) => setDraftSetting((current) => ({ ...(current || settingState), point_redeem_value: value || null }))}
                  hint="Cuantos pesos vale cada punto al canjear. Ejemplo: si vale 10, 100 puntos descuentan $1000."
                />
              </div>

              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <p>Acumulacion: Por cada ${Number(settingState.currency_unit_amount || 0).toLocaleString()} tus clientes ganan {settingState.points_earned || 0} punto(s).</p>
                <p>
                  Canje: Cada 100 puntos valen ${Math.round(Number(settingState.point_redeem_value || 0) * 100).toLocaleString()} de descuento.
                </p>
              </div>

              <Button
                disabled={settingLoading || isSaving}
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
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers">
          <TiersTab restaurantId={restaurantId} tierApi={tierApi} />
        </TabsContent>

        <TabsContent value="rewards">
          <RewardsTab restaurantId={restaurantId} rewardApi={rewardApi} />
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

function TiersTab({ restaurantId, tierApi }) {
  const { tiers, create, update, remove } = tierApi
  const [editingId, setEditingId] = useState("")
  const [draft, setDraft] = useState({ name: "", min_points: 0 })
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (!editingId) {
      return
    }
    const row = tiers.find((tier) => tier.id === editingId)
    if (!row) {
      setEditingId("")
      setDraft({ name: "", min_points: 0 })
      setSaveError("")
    }
  }, [editingId, tiers])

  const startEditing = (tier) => {
    setEditingId(tier.id)
    setDraft({ name: tier.name, min_points: tier.min_points })
    setSaveError("")
  }

  const saveTier = async (tier) => {
    if (!draft.name.trim()) {
      setSaveError("El nombre es obligatorio.")
      return
    }
    try {
      await update(tier.id, {
        name: draft.name.trim(),
        min_points: Number(draft.min_points || 0),
      })
      setEditingId("")
      setDraft({ name: "", min_points: 0 })
      setSaveError("")
      toast.success("Nivel actualizado")
    } catch (error) {
      setSaveError(error.message || "No fue posible guardar este nivel")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Niveles de fidelidad</CardTitle>
        <CardDescription>Segmenta a tus clientes por puntos. Por ahora el nivel es informativo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aun no tienes niveles. Por defecto todos tus clientes quedan en nivel Base. Crea niveles como Bronce (0), Plata (500) y Oro (2000).
          </div>
        ) : null}
        {tiers.map((tier) => (
          <div key={tier.id} className="rounded-lg border p-3">
            {editingId === tier.id ? (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" />
                  <Input type="number" value={draft.min_points} onChange={(event) => setDraft((current) => ({ ...current, min_points: Number(event.target.value || 0) }))} placeholder="Desde N puntos" />
                </div>
                {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveTier(tier)}>Guardar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(""); setSaveError("") }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-center">
                <p className="font-medium">{tier.name}</p>
                <p className="text-sm text-muted-foreground">Desde {tier.min_points} puntos</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEditing(tier)}>Editar</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await remove(tier.id)
                        toast.success("Nivel eliminado")
                      } catch (error) {
                        toast.error(error.message || "No fue posible eliminar el nivel")
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        <Button
          onClick={async () => {
            try {
              await create({
                restaurant: restaurantId,
                code: `tier_${Date.now()}`,
                name: "Nuevo nivel",
                min_points: 0,
                max_points: null,
              })
              toast.success("Nivel creado")
            } catch (error) {
              toast.error(error.message || "No fue posible crear el nivel")
            }
          }}
        >
          Agregar nivel
        </Button>
      </CardContent>
    </Card>
  )
}

function RewardsTab({ restaurantId, rewardApi }) {
  const { rewards, create, update, remove } = rewardApi
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReward, setEditingReward] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [form, setForm] = useState({
    name: "",
    description: "",
    points_cost: 100,
    available_quantity: "",
    max_per_user: "",
    valid_until: "",
    is_active: true,
  })

  const openCreate = () => {
    setEditingReward(null)
    setForm({
      name: "",
      description: "",
      points_cost: 100,
      available_quantity: "",
      max_per_user: "",
      valid_until: "",
      is_active: true,
    })
    setFormError("")
    setDialogOpen(true)
  }

  const openEdit = (reward) => {
    setEditingReward(reward)
    setForm({
      name: reward.name,
      description: reward.description || "",
      points_cost: reward.points_cost,
      available_quantity: reward.available_quantity ?? "",
      max_per_user: reward.max_per_user ?? "",
      valid_until: reward.valid_until ?? "",
      is_active: Boolean(reward.is_active),
    })
    setFormError("")
    setDialogOpen(true)
  }

  const statusForReward = (reward) => {
    if (!reward.is_active) return "Pausada"
    if (reward.available_quantity === 0) return "Sin cupos"
    if (reward.valid_until && new Date(reward.valid_until) < new Date()) return "Vencida"
    return "Activa"
  }

  const saveReward = async () => {
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio")
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        restaurant: restaurantId,
        name: form.name.trim(),
        description: form.description || "",
        points_cost: Number(form.points_cost || 0),
        available_quantity: form.available_quantity === "" ? null : Number(form.available_quantity),
        max_per_user: form.max_per_user === "" ? null : Number(form.max_per_user),
        valid_until: form.valid_until || null,
        is_active: Boolean(form.is_active),
      }
      if (editingReward?.id) {
        await update(editingReward.id, payload)
        toast.success("Recompensa actualizada")
      } else {
        await create(payload)
        toast.success("Recompensa creada")
      }
      setDialogOpen(false)
    } catch (error) {
      setFormError(error.message || "No fue posible guardar la recompensa")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recompensas</CardTitle>
        <CardDescription>Las recompensas son lo que tus clientes pueden canjear con puntos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {rewards.map((reward) => (
            <div key={reward.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold">{reward.name}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{reward.description || "Sin descripcion"}</p>
                </div>
                <Badge variant="secondary">{statusForReward(reward)}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Badge>{reward.points_cost} puntos</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(reward)}>Editar</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await remove(reward.id)
                        toast.success("Recompensa eliminada")
                      } catch (error) {
                        toast.error(error.message || "No fue posible eliminar la recompensa")
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={openCreate}>Agregar recompensa</Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingReward ? "Editar recompensa" : "Nueva recompensa"}</DialogTitle>
              <DialogDescription>Configura la recompensa que vera el cliente al canjear puntos.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <FieldWithHint
                label="Nombre"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Descripcion</Label>
                  <InfoHint>Texto que vera el cliente. Ejemplo: Postre del dia gratis.</InfoHint>
                </div>
                <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
              </div>
              <FieldWithHint
                label="Costo en puntos"
                type="number"
                value={form.points_cost}
                onChange={(value) => setForm((current) => ({ ...current, points_cost: Number(value || 0) }))}
                hint="Cuantos puntos cuesta canjear esta recompensa."
              />
              <FieldWithHint
                label="Cupos disponibles"
                type="number"
                value={form.available_quantity}
                onChange={(value) => setForm((current) => ({ ...current, available_quantity: value }))}
                hint="Stock global. Vacio = sin limite."
              />
              <FieldWithHint
                label="Maximo por usuario"
                type="number"
                value={form.max_per_user}
                onChange={(value) => setForm((current) => ({ ...current, max_per_user: value }))}
                hint="Cuantas veces el mismo cliente puede canjear. Vacio = sin limite."
              />
              <FieldWithHint
                label="Vigente hasta"
                type="date"
                value={form.valid_until}
                onChange={(value) => setForm((current) => ({ ...current, valid_until: value }))}
                hint="Fecha de vencimiento. Vacio = sin vencimiento."
              />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Activa</p>
                  <p className="text-sm text-muted-foreground">Si esta apagada no aparece para clientes.</p>
                </div>
                <Switch checked={Boolean(form.is_active)} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveReward} disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function FieldWithHint({ label, value, onChange, type = "text", hint = "" }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </div>
      <Input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
