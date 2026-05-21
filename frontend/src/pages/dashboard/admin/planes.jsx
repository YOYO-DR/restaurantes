import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiJson } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Plus, ChevronDown, ChevronUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PLANS_BASE = "/api/admin/billing/plans"
const FEATURES_BASE = "/api/admin/billing/features"

function PlanForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    price_amount: initial?.price_amount ?? "0.00",
    currency_code: initial?.currency_code ?? "COP",
    is_active: initial?.is_active ?? true,
    is_default: initial?.is_default ?? false,
    sort_order: initial?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = initial ? `${PLANS_BASE}/${initial.id}/` : `${PLANS_BASE}/`
      const method = initial ? "PATCH" : "POST"
      const saved = await apiJson(url, { method, body: JSON.stringify(form) })
      onSave(saved)
    } catch (err) {
      toast.error(err?.detail ?? "Error al guardar el plan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required disabled={!!initial} />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label>Precio</Label>
          <Input type="number" step="0.01" value={form.price_amount} onChange={(e) => setForm((p) => ({ ...p, price_amount: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Moneda</Label>
          <Input value={form.currency_code} onChange={(e) => setForm((p) => ({ ...p, currency_code: e.target.value }))} maxLength={3} />
        </div>
        <div className="space-y-1">
          <Label>Orden</Label>
          <Input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: +e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
          <Label>Activo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_default} onCheckedChange={(v) => setForm((p) => ({ ...p, is_default: v }))} />
          <Label>Por defecto</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </form>
  )
}

function PlanFeaturesMatrix({ plan, features, onSaved }) {
  const ACTION_LABELS = ["view", "create", "edit", "delete"]
  const [matrix, setMatrix] = useState({})
  const [autoExpand, setAutoExpand] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const initial = {}
    plan.features?.forEach((pf) => {
      initial[pf.feature] = {
        can_view: pf.can_view,
        can_create: pf.can_create,
        can_edit: pf.can_edit,
        can_delete: pf.can_delete,
      }
    })
    setMatrix(initial)
  }, [plan])

  const toggle = (featureId, action) => {
    setMatrix((prev) => {
      const curr = prev[featureId] ?? { can_view: false, can_create: false, can_edit: false, can_delete: false }
      const next = { ...curr, [`can_${action}`]: !curr[`can_${action}`] }
      if (action === "view" && !next.can_view) {
        next.can_create = false; next.can_edit = false; next.can_delete = false
      }
      return { ...prev, [featureId]: next }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const featuresList = Object.entries(matrix).map(([feature_id, perms]) => ({ feature_id, ...perms }))
      const updated = await apiJson(`${PLANS_BASE}/${plan.id}/features/`, {
        method: "POST",
        body: JSON.stringify({ features: featuresList, auto_expand_deps: autoExpand }),
      })
      toast.success("Permisos guardados")
      onSaved(updated)
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Error de dependencias")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={autoExpand} onCheckedChange={setAutoExpand} id="auto-expand" />
        <label htmlFor="auto-expand">Auto-incluir dependencias</label>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Feature</th>
              {ACTION_LABELS.map((a) => (
                <th key={a} className="px-3 py-2 text-center font-medium capitalize">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => {
              const perms = matrix[f.id] ?? { can_view: false, can_create: false, can_edit: false, can_delete: false }
              return (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{f.code}</p>
                  </td>
                  {ACTION_LABELS.map((action) => (
                    <td key={action} className="px-3 py-2 text-center">
                      <Checkbox
                        checked={perms[`can_${action}`]}
                        onCheckedChange={() => toggle(f.id, action)}
                        disabled={action !== "view" && !perms.can_view}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar permisos"}</Button>
    </div>
  )
}

export default function AdminPlanesPage() {
  const [plans, setPlans] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [plansData, featuresData] = await Promise.all([
        apiJson(`${PLANS_BASE}/`),
        apiJson(`${FEATURES_BASE}/`),
      ])
      setPlans(plansData?.results ?? plansData)
      setFeatures((featuresData?.results ?? featuresData).filter((f) => f.is_active))
    } catch {
      toast.error("Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleExpand = async (planId) => {
    if (expanded === planId) {
      setExpanded(null)
      setExpandedDetail(null)
      return
    }
    setExpanded(planId)
    setExpandedDetail(null)
    setLoadingDetail(true)
    try {
      const detail = await apiJson(`${PLANS_BASE}/${planId}/`)
      setExpandedDetail(detail)
    } catch {
      toast.error("Error al cargar permisos del plan")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSave = (saved) => {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
    setDialog(null)
    toast.success("Plan guardado")
  }

  const handleFeaturesSaved = async (planId) => {
    const updated = await apiJson(`${PLANS_BASE}/${planId}/`).catch(() => null)
    if (updated) {
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setExpandedDetail(updated)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planes</h1>
          <p className="text-sm text-muted-foreground">Gestiona los planes de suscripción y sus permisos</p>
        </div>
        <Button onClick={() => setDialog("create")}><Plus className="mr-2 h-4 w-4" />Nuevo plan</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          {plans.sort((a, b) => a.sort_order - b.sort_order).map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{plan.code}</span>
                    {plan.is_free && <Badge variant="secondary">Free</Badge>}
                    {plan.is_default && <Badge>Default</Badge>}
                    {!plan.is_active && <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {Number(plan.price_amount) === 0 ? "Gratis" : `$${Number(plan.price_amount).toLocaleString()} ${plan.currency_code}`}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => setDialog(plan)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleExpand(plan.id)}>
                      {expanded === plan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expanded === plan.id && (
                <CardContent>
                  {loadingDetail ? (
                    <p className="text-sm text-muted-foreground">Cargando permisos…</p>
                  ) : expandedDetail ? (
                    <PlanFeaturesMatrix
                      plan={expandedDetail}
                      features={features}
                      onSaved={() => handleFeaturesSaved(plan.id)}
                    />
                  ) : null}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Nuevo plan" : "Editar plan"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <PlanForm
              initial={dialog === "create" ? null : dialog}
              onSave={handleSave}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
