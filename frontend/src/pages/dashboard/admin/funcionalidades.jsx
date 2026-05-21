import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiJson } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const BASE = "/api/admin/billing/features"

function FeatureForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    description: initial?.description ?? "",
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = initial ? `${BASE}/${initial.id}/` : `${BASE}/`
      const method = initial ? "PATCH" : "POST"
      const saved = await apiJson(url, { method, body: JSON.stringify(form) })
      onSave(saved)
    } catch {
      toast.error("Error al guardar la funcionalidad")
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
          <Label>Categoría</Label>
          <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
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
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
        <Label>Activa</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </form>
  )
}

export default function AdminFuncionalidadesPage() {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null) // null | "create" | feature obj

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiJson(`${BASE}/`)
      setFeatures(data?.results ?? data)
    } catch {
      toast.error("Error al cargar funcionalidades")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = (saved) => {
    setFeatures((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
    setDialog(null)
    toast.success("Funcionalidad guardada")
  }

  const handleToggle = async (feature) => {
    try {
      const updated = await apiJson(`${BASE}/${feature.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !feature.is_active }),
      })
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    } catch {
      toast.error("Error al actualizar")
    }
  }

  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiJson(`${BASE}/${deleteTarget}/`, { method: "DELETE" })
      setFeatures((prev) => prev.filter((f) => f.id !== deleteTarget))
      toast.success("Eliminada")
    } catch {
      toast.error("No se pudo eliminar")
    } finally {
      setDeleteTarget(null)
    }
  }

  const categoryGroups = features.reduce((acc, f) => {
    const key = f.category || "General"
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funcionalidades</h1>
          <p className="text-sm text-muted-foreground">Gestiona el catálogo de features del sistema</p>
        </div>
        <Button onClick={() => setDialog("create")}><Plus className="mr-2 h-4 w-4" />Nueva</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        Object.entries(categoryGroups).map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.sort((a, b) => a.sort_order - b.sort_order).map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={f.is_active} onCheckedChange={() => handleToggle(f)} />
                    <div>
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{f.code}</p>
                    </div>
                    {!f.is_active && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setDialog(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(f.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Nueva funcionalidad" : "Editar funcionalidad"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <FeatureForm
              initial={dialog === "create" ? null : dialog}
              onSave={handleSave}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar funcionalidad</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Estás seguro? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
