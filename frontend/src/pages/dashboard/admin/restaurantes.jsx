import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CreditCard,
  Loader2,
  Search,
  Settings2,
  Trash2,
} from "lucide-react"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { apiJson } from "@/lib/api"
import { useAdminRestaurantEditor, useAdminRestaurants } from "@/hooks/use-admin"
import { formatCurrency } from "@/lib/format"

const SUB_API = "/api/admin/billing/restaurant-subscriptions"
const PLANS_API = "/api/admin/billing/plans"
const FEATURES_API = "/api/admin/billing/features"

const STATUS_BADGE = {
  trial: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-orange-100 text-orange-800",
  expired: "bg-slate-100 text-slate-600",
}
const STATUS_LABEL = {
  trial: "Trial",
  active: "Activo",
  cancelled: "Cancelado",
  expired: "Expirado",
}

function RestaurantSubscriptionModal({ restaurantId, restaurantName, onClose }) {
  const [sub, setSub] = useState(null)
  const [plans, setPlans] = useState([])
  const [features, setFeatures] = useState([])
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingAction, setLoadingAction] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("")
  const [trialDays, setTrialDays] = useState("")
  const [overrideForm, setOverrideForm] = useState(null)

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    Promise.all([
      apiJson(`${SUB_API}/${restaurantId}/`),
      apiJson(`${PLANS_API}/`),
      apiJson(`${FEATURES_API}/`),
      apiJson(`${SUB_API}/${restaurantId}/overrides/`),
    ]).then(([subData, plansData, featuresData, overridesData]) => {
      setSub(subData)
      setSelectedPlan(subData.plan ?? "")
      setTrialDays(subData.override_trial_days ?? "")
      setPlans((plansData?.results ?? plansData).filter((p) => p.is_active))
      setFeatures((featuresData?.results ?? featuresData).filter((f) => f.is_active))
      setOverrides(Array.isArray(overridesData) ? overridesData : (overridesData?.results ?? []))
    }).catch(() => {
      toast.error("Error al cargar la suscripción")
    }).finally(() => {
      setLoading(false)
    })
  }, [restaurantId])

  const patch = async (body, action = "") => {
    setSaving(true)
    setLoadingAction(action)
    try {
      const updated = await apiJson(`${SUB_API}/${restaurantId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      setSub(updated)
      setSelectedPlan(updated.plan ?? "")
      setTrialDays(updated.override_trial_days ?? "")
      toast.success("Suscripción actualizada")
    } catch (err) {
      toast.error(err?.detail ?? "Error al actualizar")
    } finally {
      setSaving(false)
      setLoadingAction("")
    }
  }

  const addOverride = async () => {
    if (!overrideForm?.feature) return
    setSaving(true)
    setLoadingAction("addOverride")
    try {
      const created = await apiJson(`${SUB_API}/${restaurantId}/overrides/`, {
        method: "POST",
        body: JSON.stringify(overrideForm),
      })
      setOverrides((prev) => {
        const idx = prev.findIndex((o) => o.feature === created.feature)
        if (idx >= 0) { const next = [...prev]; next[idx] = created; return next }
        return [...prev, created]
      })
      setOverrideForm(null)
      toast.success("Override guardado")
    } catch (err) {
      toast.error(err?.detail ?? "Error al guardar override")
    } finally {
      setSaving(false)
      setLoadingAction("")
    }
  }

  const resetTrialHandler = async () => {
    await patch({ force_reset_trial: true }, "resetTrial")
  }

  const saveTrialDaysHandler = async () => {
    await patch({ override_trial_days: Number(trialDays) }, "saveTrialDays")
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suscripción — {restaurantName}</DialogTitle>
          <DialogDescription>Administra el plan, trial y overrides de features de este restaurante.</DialogDescription>
        </DialogHeader>

        {loading || !sub ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando suscripción…
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Estado actual ── */}
            <div className="rounded-xl border border-border/70 p-4 space-y-2">
              <p className="text-sm font-semibold">Estado actual</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_BADGE[sub.status] ?? "bg-slate-100 text-slate-700"}>
                  {STATUS_LABEL[sub.status] ?? sub.status}
                </Badge>
                <span className="text-sm font-medium">{sub.plan_name}</span>
              </div>
              {sub.status === "trial" && sub.trial_end && (
                <p className="text-xs text-muted-foreground">
                  Trial termina: <span className="font-medium">{new Date(sub.trial_end).toLocaleDateString("es-CO")}</span>
                  {sub.override_trial_days ? ` · Override: ${sub.override_trial_days} días` : ""}
                </p>
              )}
              {sub.current_period_end && (
                <p className="text-xs text-muted-foreground">
                  Período hasta: <span className="font-medium">{new Date(sub.current_period_end).toLocaleDateString("es-CO")}</span>
                </p>
              )}
              {sub.cancelled_at && (
                <p className="text-xs text-orange-600">
                  Cancelado el {new Date(sub.cancelled_at).toLocaleDateString("es-CO")}
                </p>
              )}
            </div>

            {/* ── Cambiar plan ── */}
            <div className="relative space-y-2">
              <p className="text-sm font-semibold">Cambiar plan</p>
              <p className="text-xs text-muted-foreground">El cambio es inmediato y no requiere aprobación del propietario.</p>
              <div className={loadingAction === "applyPlan" ? "space-y-2 opacity-35 transition-opacity" : "space-y-2 transition-opacity"}>
                <div className="flex gap-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.is_free ? " (Gratis)" : ` — $${Number(p.price_amount).toLocaleString()} ${p.currency_code}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => patch({ plan: selectedPlan }, "applyPlan")} disabled={saving || !selectedPlan || selectedPlan === sub.plan}>
                    {loadingAction === "applyPlan" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
              </div>

              {loadingAction === "applyPlan" ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/35 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aplicando plan...
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Trial ── (solo si está en trial) */}
            {sub.status === "trial" && (
              <div className="relative space-y-2">
                <p className="text-sm font-semibold">Duración del trial</p>
                <p className="text-xs text-muted-foreground">
                  Días totales desde el inicio del trial. Deja vacío para usar el default global.
                  {sub.override_trial_days ? ` Actualmente con override de ${sub.override_trial_days} días.` : " Sin override, usando default global."}
                </p>
                <div className={loadingAction === "saveTrialDays" || loadingAction === "resetTrial" ? "space-y-2 opacity-35 transition-opacity" : "space-y-2 transition-opacity"}>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      placeholder="Ej: 30"
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      className="w-40"
                    />
                    <Button onClick={saveTrialDaysHandler} disabled={saving || !trialDays || Number(trialDays) < 1}>
                      {loadingAction === "saveTrialDays" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar días"
                      )}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetTrialHandler} disabled={saving}>
                    {loadingAction === "resetTrial" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reiniciando...
                      </>
                    ) : (
                      "Reiniciar trial desde cero"
                    )}
                  </Button>
                </div>

                {loadingAction === "saveTrialDays" || loadingAction === "resetTrial" ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/35 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingAction === "resetTrial" ? "Reiniciando trial..." : "Guardando días..."}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Overrides de features ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Overrides de funcionalidades</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOverrideForm({ feature: "", can_view: true, can_create: true, can_edit: false, can_delete: false })}
                >
                  + Agregar
                </Button>
              </div>

              {overrides.length === 0 && !overrideForm && (
                <p className="text-xs text-muted-foreground">Sin overrides individuales. El restaurante usa los permisos de su plan.</p>
              )}

              {overrides.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">Feature</th>
                        <th className="px-2 py-2 text-center">Ver</th>
                        <th className="px-2 py-2 text-center">Crear</th>
                        <th className="px-2 py-2 text-center">Editar</th>
                        <th className="px-2 py-2 text-center">Eliminar</th>
                        <th className="px-2 py-2 text-center">Fuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map((ov) => (
                        <tr key={ov.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{ov.feature_name} <span className="font-mono text-muted-foreground">({ov.feature_code})</span></td>
                          <td className="px-2 py-2 text-center">{ov.can_view ? "✓" : "—"}</td>
                          <td className="px-2 py-2 text-center">{ov.can_create ? "✓" : "—"}</td>
                          <td className="px-2 py-2 text-center">{ov.can_edit ? "✓" : "—"}</td>
                          <td className="px-2 py-2 text-center">{ov.can_delete ? "✓" : "—"}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`rounded px-1.5 py-0.5 text-xs ${ov.source === "admin" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                              {ov.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {overrideForm && (
                <div className="relative rounded-xl border border-dashed border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Nuevo override</p>
                  <div className={loadingAction === "addOverride" ? "space-y-3 opacity-35 transition-opacity" : "space-y-3 transition-opacity"}>
                    <div className="space-y-1">
                      <Label className="text-xs">Funcionalidad</Label>
                      <Select value={overrideForm.feature} onValueChange={(v) => setOverrideForm((p) => ({ ...p, feature: v }))}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecciona una funcionalidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {features.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name} <span className="text-muted-foreground font-mono text-xs">({f.code})</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {["can_view", "can_create", "can_edit", "can_delete"].map((k) => (
                        <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={overrideForm[k]}
                            onCheckedChange={(v) => setOverrideForm((p) => ({ ...p, [k]: Boolean(v) }))}
                          />
                          {k.replace("can_", "")}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addOverride} disabled={saving || !overrideForm.feature}>
                        {loadingAction === "addOverride" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar override"
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOverrideForm(null)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {loadingAction === "addOverride" ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/35 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando override...
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_META = {
  active: { label: "Activo", className: "bg-emerald-100 text-emerald-800" },
  inactive: { label: "Inactivo", className: "bg-slate-100 text-slate-700" },
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const COLUMNS = [
  { key: "name", label: "Restaurante" },
  { key: "owner", label: "Propietario" },
  { key: "category", label: "Categoria" },
  { key: "status", label: "Estado" },
  { key: "subscription_plan", label: "Plan" },
  { key: "orders_count", label: "Pedidos" },
  { key: "revenue", label: "Ingresos" },
  { key: "joined_at", label: "Registro" },
]

function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

function createEditForm(payload) {
  return {
    display_name: payload.display_name || "",
    slug: payload.slug || "",
    legal_name: payload.legal_name || "",
    nit: payload.nit || "",
    email: payload.email || "",
    phone: payload.phone || "",
    currency_code: payload.currency_code || "COP",
    description: payload.description || "",
    category: payload.category || "",
    status: payload.status || "active",
    subscription_plan: payload.subscription_plan || "",
    delivery_enabled: Boolean(payload.delivery_enabled),
    pickup_enabled: Boolean(payload.pickup_enabled),
    table_order_enabled: Boolean(payload.table_order_enabled),
    delivery_fee_amount: payload.delivery_fee_amount || "0.00",
    min_order_amount: payload.min_order_amount || "",
    estimated_min_minutes: payload.estimated_min_minutes || "",
    estimated_max_minutes: payload.estimated_max_minutes || "",
  }
}

export default function AdminRestaurants() {
  const [filters, setFilters] = useState({
    name: "",
    owner: "",
    category: "",
    status: "todos",
    subscriptionPlan: "",
    ordersCount: "",
    revenue: "",
    joinedAt: "",
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState("-joined_at")
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogLoading, setIsDialogLoading] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [subModal, setSubModal] = useState(null)

  const debouncedName = useDebouncedValue(filters.name)
  const debouncedOwner = useDebouncedValue(filters.owner)
  const debouncedCategory = useDebouncedValue(filters.category)
  const debouncedSubscriptionPlan = useDebouncedValue(filters.subscriptionPlan)
  const debouncedOrdersCount = useDebouncedValue(filters.ordersCount)
  const debouncedRevenue = useDebouncedValue(filters.revenue)
  const debouncedJoinedAt = useDebouncedValue(filters.joinedAt)

  const query = useMemo(
    () => ({
      page,
      pageSize,
      ordering,
      name: debouncedName.trim(),
      owner: debouncedOwner.trim(),
      category: debouncedCategory.trim(),
      status: filters.status,
      subscriptionPlan: debouncedSubscriptionPlan.trim(),
      ordersCount: debouncedOrdersCount.trim(),
      revenue: debouncedRevenue.trim(),
      joinedAt: debouncedJoinedAt,
    }),
    [
      debouncedCategory,
      debouncedJoinedAt,
      debouncedName,
      debouncedOrdersCount,
      debouncedOwner,
      debouncedRevenue,
      debouncedSubscriptionPlan,
      filters.status,
      ordering,
      page,
      pageSize,
    ],
  )

  const { data, isLoading, error } = useAdminRestaurants(query)
  const { loadRestaurant, saveRestaurant, isSaving } = useAdminRestaurantEditor()

  useEffect(() => {
    setPage(1)
  }, [debouncedCategory, debouncedJoinedAt, debouncedName, debouncedOrdersCount, debouncedOwner, debouncedRevenue, debouncedSubscriptionPlan, filters.status, ordering, pageSize])

  const toggleOrdering = (columnKey) => {
    setOrdering((current) => {
      if (current === columnKey) return `-${columnKey}`
      if (current === `-${columnKey}`) return columnKey
      return columnKey
    })
  }

  const openSettings = async (restaurantId) => {
    setSelectedRestaurantId(restaurantId)
    setIsDialogOpen(true)
    setIsDialogLoading(true)
    try {
      const payload = await loadRestaurant(restaurantId)
      setEditForm(createEditForm(payload))
    } catch (loadError) {
      toast.error(loadError.message || "No fue posible cargar la configuracion del restaurante")
      setIsDialogOpen(false)
    } finally {
      setIsDialogLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const updated = await saveRestaurant(selectedRestaurantId, {
        ...editForm,
        delivery_fee_amount: editForm.delivery_fee_amount || "0.00",
        min_order_amount: editForm.min_order_amount === "" ? null : editForm.min_order_amount,
        estimated_min_minutes: editForm.estimated_min_minutes === "" ? null : Number(editForm.estimated_min_minutes),
        estimated_max_minutes: editForm.estimated_max_minutes === "" ? null : Number(editForm.estimated_max_minutes),
      })
      toast.success(`Restaurante ${updated.display_name} actualizado`)
      setIsDialogOpen(false)
    } catch (saveError) {
      toast.error(saveError.message || "No fue posible guardar los cambios del restaurante")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestion de restaurantes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tabla responsiva con filtros, paginacion y acceso a ajustes administrativos para editar o inactivar restaurantes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Total filtrado" value={data?.counts?.total ?? 0} />
        <SummaryCard title="Activos" value={data?.counts?.active ?? 0} />
        <SummaryCard title="Inactivos u otros" value={(data?.counts?.inactive ?? 0) + (data?.counts?.other ?? 0)} />
      </div>

      {isLoading && !data ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {!isLoading || data ? (
        <>
          <div className="hidden lg:block">
            <DesktopRestaurantsTable
              data={data}
              filters={filters}
              isLoading={isLoading}
              ordering={ordering}
              onFilterChange={setFilters}
              onOrderingChange={toggleOrdering}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              onOpenSettings={openSettings}
              onOpenSubscription={(r) => setSubModal({ id: r.id, name: r.name })}
            />
          </div>
          <div className="lg:hidden">
            <MobileRestaurantsList
              data={data}
              filters={filters}
              isLoading={isLoading}
              onFilterChange={setFilters}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              onOpenSettings={openSettings}
              onOpenSubscription={(r) => setSubModal({ id: r.id, name: r.name })}
            />
          </div>
        </>
      ) : null}

      {subModal && (
        <RestaurantSubscriptionModal
          restaurantId={subModal.id}
          restaurantName={subModal.name}
          onClose={() => setSubModal(null)}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ajustes del restaurante</DialogTitle>
            <DialogDescription>
              Modifica datos operativos del restaurante, cambia su plan o inactivalo si necesitas pausarlo.
            </DialogDescription>
          </DialogHeader>

          {isDialogLoading || !editForm ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando ajustes...
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Field label="Nombre comercial"><Input value={editForm.display_name} onChange={(event) => setEditForm((current) => ({ ...current, display_name: event.target.value }))} /></Field>
              <Field label="Slug"><Input value={editForm.slug} onChange={(event) => setEditForm((current) => ({ ...current, slug: event.target.value }))} /></Field>
              <Field label="Razon social"><Input value={editForm.legal_name} onChange={(event) => setEditForm((current) => ({ ...current, legal_name: event.target.value }))} /></Field>
              <Field label="NIT"><Input value={editForm.nit} onChange={(event) => setEditForm((current) => ({ ...current, nit: event.target.value }))} /></Field>
              <Field label="Email"><Input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} /></Field>
              <Field label="Telefono"><Input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
              <Field label="Moneda"><Input value={editForm.currency_code} onChange={(event) => setEditForm((current) => ({ ...current, currency_code: event.target.value.toUpperCase() }))} /></Field>
              <Field label="Estado">
                <Select value={editForm.status} onValueChange={(value) => setEditForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalogs?.statuses || []).map((option) => (
                      <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria">
                <Select value={editForm.category} onValueChange={(value) => setEditForm((current) => ({ ...current, category: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalogs?.categories || []).map((option) => (
                      <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Plan">
                <Select value={editForm.subscription_plan} onValueChange={(value) => setEditForm((current) => ({ ...current, subscription_plan: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalogs?.subscription_plans || []).map((option) => (
                      <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tarifa de domicilio"><Input type="number" value={editForm.delivery_fee_amount} onChange={(event) => setEditForm((current) => ({ ...current, delivery_fee_amount: event.target.value }))} /></Field>
              <Field label="Pedido minimo"><Input type="number" value={editForm.min_order_amount} onChange={(event) => setEditForm((current) => ({ ...current, min_order_amount: event.target.value }))} /></Field>
              <Field label="Minutos estimados min"><Input type="number" value={editForm.estimated_min_minutes} onChange={(event) => setEditForm((current) => ({ ...current, estimated_min_minutes: event.target.value }))} /></Field>
              <Field label="Minutos estimados max"><Input type="number" value={editForm.estimated_max_minutes} onChange={(event) => setEditForm((current) => ({ ...current, estimated_max_minutes: event.target.value }))} /></Field>
              <Field label="Descripcion" className="lg:col-span-2"><textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></Field>

              <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3">
                <ToggleCard title="Domicilio" checked={editForm.delivery_enabled} onChange={(checked) => setEditForm((current) => ({ ...current, delivery_enabled: checked }))} />
                <ToggleCard title="Recoger en tienda" checked={editForm.pickup_enabled} onChange={(checked) => setEditForm((current) => ({ ...current, pickup_enabled: checked }))} />
                <ToggleCard title="Pedidos por mesa" checked={editForm.table_order_enabled} onChange={(checked) => setEditForm((current) => ({ ...current, table_order_enabled: checked }))} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm((current) => ({ ...current, status: "inactive" }))} disabled={!editForm || isSaving}>Marcar como inactivo</Button>
            <Button onClick={handleSave} disabled={isDialogLoading || !editForm || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
              Guardar ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DesktopRestaurantsTable({ data, filters, isLoading, ordering, onFilterChange, onOrderingChange, pageSize, onPageSizeChange, onPageChange, onOpenSettings, onOpenSubscription }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <table className="w-full table-fixed">
          <thead className="bg-muted/70">
            <tr className="border-b border-border">
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                  <button type="button" onClick={() => onOrderingChange(column.key)} className="inline-flex items-center gap-2">
                    {column.label}
                    <OrderingIcon ordering={ordering} columnKey={column.key} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Ajustes</th>
            </tr>
            <tr className="border-b border-border bg-background">
              <th className="px-4 py-3"><FilterInput value={filters.name} onChange={(value) => onFilterChange((current) => ({ ...current, name: value }))} placeholder="Restaurante" icon={<Search className="h-4 w-4" />} /></th>
              <th className="px-4 py-3"><FilterInput value={filters.owner} onChange={(value) => onFilterChange((current) => ({ ...current, owner: value }))} placeholder="Propietario" /></th>
              <th className="px-4 py-3"><FilterInput value={filters.category} onChange={(value) => onFilterChange((current) => ({ ...current, category: value }))} placeholder="Categoria" /></th>
              <th className="px-4 py-3"><Select value={filters.status} onValueChange={(value) => onFilterChange((current) => ({ ...current, status: value }))}><SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select></th>
              <th className="px-4 py-3"><FilterInput value={filters.subscriptionPlan} onChange={(value) => onFilterChange((current) => ({ ...current, subscriptionPlan: value }))} placeholder="Plan" /></th>
              <th className="px-4 py-3"><FilterInput value={filters.ordersCount} onChange={(value) => onFilterChange((current) => ({ ...current, ordersCount: value }))} placeholder="Pedidos" /></th>
              <th className="px-4 py-3"><FilterInput value={filters.revenue} onChange={(value) => onFilterChange((current) => ({ ...current, revenue: value }))} placeholder="Ingresos exactos" /></th>
              <th className="px-4 py-3"><Input type="date" value={filters.joinedAt} onChange={(event) => onFilterChange((current) => ({ ...current, joinedAt: event.target.value }))} className="h-9" /></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={isLoading ? "opacity-35 transition-opacity" : "transition-opacity"}>
            {data?.results?.map((restaurant) => {
              const statusMeta = STATUS_META[restaurant.status] || { label: restaurant.status_label, className: "bg-amber-100 text-amber-800" }
              return (
                <tr key={restaurant.id} className="border-b border-border/70 align-top last:border-b-0">
                  <td className="px-4 py-4"><p className="font-medium text-foreground">{restaurant.name}</p><p className="text-xs text-muted-foreground">Rating {restaurant.rating.toFixed(1)}</p></td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{restaurant.owner_name}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{restaurant.category}</td>
                  <td className="px-4 py-4"><Badge className={statusMeta.className}>{statusMeta.label}</Badge></td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{restaurant.subscription_plan}</td>
                  <td className="px-4 py-4 text-sm text-foreground">{restaurant.orders_count}</td>
                  <td className="px-4 py-4 text-sm text-foreground">{formatCurrency(restaurant.revenue)}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(restaurant.joined_at).toLocaleDateString("es-CO")}</td>
                  <td className="px-4 py-4">
                    <TooltipProvider>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => onOpenSettings(restaurant.id)}><Settings2 className="h-4 w-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Ajustes</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => onOpenSubscription(restaurant)}><CreditCard className="h-4 w-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Suscripción</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              )
            })}
            {!isLoading && data?.results?.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No se encontraron restaurantes con esos filtros.</td></tr> : null}
          </tbody>
        </table>

        {isLoading ? <FilteringOverlay /> : null}
      </div>

      <PaginationFooter data={data} isLoading={isLoading} pageSize={pageSize} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
    </Card>
  )
}

function MobileRestaurantsList({ data, filters, isLoading, onFilterChange, pageSize, onPageSizeChange, onPageChange, onOpenSettings, onOpenSubscription }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterInput value={filters.name} onChange={(value) => onFilterChange((current) => ({ ...current, name: value }))} placeholder="Restaurante" icon={<Search className="h-4 w-4" />} />
          <FilterInput value={filters.owner} onChange={(value) => onFilterChange((current) => ({ ...current, owner: value }))} placeholder="Propietario" />
          <FilterInput value={filters.category} onChange={(value) => onFilterChange((current) => ({ ...current, category: value }))} placeholder="Categoria" />
          <FilterInput value={filters.subscriptionPlan} onChange={(value) => onFilterChange((current) => ({ ...current, subscriptionPlan: value }))} placeholder="Plan" />
          <FilterInput value={filters.ordersCount} onChange={(value) => onFilterChange((current) => ({ ...current, ordersCount: value }))} placeholder="Pedidos" />
          <FilterInput value={filters.revenue} onChange={(value) => onFilterChange((current) => ({ ...current, revenue: value }))} placeholder="Ingresos" />
          <Select value={filters.status} onValueChange={(value) => onFilterChange((current) => ({ ...current, status: value }))}><SelectTrigger className="h-10"><SelectValue placeholder="Todos los estados" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los estados</SelectItem><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select>
          <Input type="date" value={filters.joinedAt} onChange={(event) => onFilterChange((current) => ({ ...current, joinedAt: event.target.value }))} />
        </div>

        <div className="relative space-y-3">
          <div className={isLoading ? "space-y-3 opacity-35 transition-opacity" : "space-y-3 transition-opacity"}>
            {data?.results?.map((restaurant) => {
              const statusMeta = STATUS_META[restaurant.status] || { label: restaurant.status_label, className: "bg-amber-100 text-amber-800" }
              return (
                <div key={restaurant.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">{restaurant.category}</p>
                    </div>
                    <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MobileStat label="Propietario" value={restaurant.owner_name} />
                    <MobileStat label="Plan" value={restaurant.subscription_plan} />
                    <MobileStat label="Pedidos" value={String(restaurant.orders_count)} />
                    <MobileStat label="Ingresos" value={formatCurrency(restaurant.revenue)} />
                    <MobileStat label="Registro" value={new Date(restaurant.joined_at).toLocaleDateString("es-CO")} />
                    <MobileStat label="Rating" value={restaurant.rating.toFixed(1)} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => onOpenSettings(restaurant.id)}><Settings2 className="mr-2 h-4 w-4" />Ajustes</Button>
                    <Button variant="outline" className="flex-1" onClick={() => onOpenSubscription(restaurant)}><CreditCard className="mr-2 h-4 w-4" />Suscripción</Button>
                  </div>
                </div>
              )
            })}
            {!isLoading && data?.results?.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No se encontraron restaurantes con esos filtros.</div> : null}
          </div>

          {isLoading ? <FilteringOverlay compact /> : null}
        </div>
      </CardContent>

      <PaginationFooter data={data} isLoading={isLoading} pageSize={pageSize} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} compact />
    </Card>
  )
}

function SummaryCard({ title, value }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-foreground">{value}</p></CardContent></Card>
}

function Field({ label, children, className = "" }) {
  return <div className={className}><label className="mb-2 block text-sm font-medium text-foreground">{label}</label>{children}</div>
}

function ToggleCard({ title, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
      <p className="font-medium text-foreground">{title}</p>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded" />
    </div>
  )
}

function FilterInput({ value, onChange, placeholder, icon = null }) {
  return <div className="relative">{icon ? <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div> : null}<Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={icon ? "h-9 pl-9" : "h-9"} /></div>
}

function PaginationFooter({ data, isLoading, pageSize, onPageSizeChange, onPageChange, compact = false }) {
  return <div className={`flex flex-col gap-4 border-t border-border p-4 ${compact ? "" : "md:flex-row md:items-center md:justify-between"}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><p className="text-sm text-muted-foreground">Pagina {data?.page ?? 1} de {data?.total_pages ?? 1}</p><Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}><SelectTrigger className="h-9 w-32"><SelectValue placeholder={`${pageSize} por pagina`} /></SelectTrigger><SelectContent>{PAGE_SIZE_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option} por pagina</SelectItem>)}</SelectContent></Select></div><div className="flex gap-2"><Button variant="outline" disabled={!data || data.page <= 1 || isLoading} onClick={() => onPageChange((current) => Math.max(current - 1, 1))}>Anterior</Button><Button variant="outline" disabled={!data || data.page >= data.total_pages || isLoading} onClick={() => onPageChange((current) => current + 1)}>Siguiente</Button></div></div>
}

function OrderingIcon({ ordering, columnKey }) {
  if (ordering === columnKey) return <ChevronUp className="h-4 w-4" />
  if (ordering === `-${columnKey}`) return <ChevronDown className="h-4 w-4" />
  return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
}

function FilteringOverlay({ compact = false }) {
  return <div className={`absolute inset-x-0 bottom-0 flex items-center justify-center bg-background/35 backdrop-blur-[1px] ${compact ? "top-0 rounded-xl" : "top-[86px]"}`}><div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm"><Loader2 className="h-4 w-4 animate-spin" />Filtrando...</div></div>
}

function MobileStat({ label, value }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium text-foreground">{value}</p></div>
}
