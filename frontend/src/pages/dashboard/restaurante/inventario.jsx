import { useEffect, useState } from "react"
import { useOperatorPermission } from "@/hooks/use-operator-permission"
import { toast } from "sonner"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useOwnerInventory } from "@/hooks/use-restaurants"
import { AlertTriangle, Loader2, Package, Plus, Search, TrendingDown } from "lucide-react"

function getStatusBadge(status) {
  switch (status) {
    case "critical":
      return <Badge variant="destructive">Critico</Badge>
    case "low":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Bajo</Badge>
    default:
      return <Badge variant="outline" className="bg-green-50 text-green-700">OK</Badge>
  }
}

function getStockPercentage(current, max) {
  if (!max || Number(max) <= 0) {
    return 0
  }

  return Math.min((Number(current) / Number(max)) * 100, 100)
}

function formatQuantity(value) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) {
    return "Sin actualizacion"
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function InventoryItemDialog({
  open,
  onOpenChange,
  initialValues,
  units,
  restaurantId,
  isSaving,
  onSubmit,
}) {
  const [form, setForm] = useState(initialValues)

  useEffect(() => {
    if (open) {
      setForm(initialValues)
    }
  }, [initialValues, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues.id ? "Editar ingrediente" : "Nuevo ingrediente"}</DialogTitle>
          <DialogDescription>Registra existencias, unidad y niveles minimos del inventario.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <div className="space-y-2">
              <Label>SKU</Label>
              <p className="text-xs text-muted-foreground">Codigo unico que identifica este ingrediente en tu inventario.</p>
              <Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={form.unit_type} onValueChange={(value) => setForm((current) => ({ ...current, unit_type: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una unidad" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Stock actual" type="number" value={form.current_stock} onChange={(value) => setForm((current) => ({ ...current, current_stock: value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stock minimo" type="number" value={form.min_stock} onChange={(value) => setForm((current) => ({ ...current, min_stock: value }))} />
            <Field label="Stock maximo" type="number" value={form.max_stock} onChange={(value) => setForm((current) => ({ ...current, max_stock: value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onSubmit({
                ...form,
                restaurant: restaurantId,
                current_stock: normalizeDecimal(form.current_stock),
                min_stock: normalizeNullableDecimal(form.min_stock),
                max_stock: normalizeNullableDecimal(form.max_stock),
              })
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar ingrediente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MovementDialog({ open, onOpenChange, item, isSaving, onSubmit }) {
  const [form, setForm] = useState({ movement_type_code: "stock_in", quantity: "", reason: "" })

  useEffect(() => {
    if (open) {
      setForm({ movement_type_code: "stock_in", quantity: "", reason: "" })
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar stock</DialogTitle>
          <DialogDescription>{item?.name || "Ingrediente"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select value={form.movement_type_code} onValueChange={(value) => setForm((current) => ({ ...current, movement_type_code: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock_in">Entrada</SelectItem>
                <SelectItem value="stock_out">Salida</SelectItem>
                <SelectItem value="stock_adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Cantidad" type="number" value={form.quantity} onChange={(value) => setForm((current) => ({ ...current, quantity: value }))} />
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onSubmit({
                ...form,
                quantity: normalizeDecimal(form.quantity),
              })
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Aplicar movimiento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MovementHistoryDialog({ open, onOpenChange, item }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial de movimientos</DialogTitle>
          <DialogDescription>{item?.name || "Ingrediente"}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {item?.movements?.length ? item.movements.map((movement) => (
            <div key={movement.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{movement.movement_type_name}</p>
                  {movement.reason ? <p className="text-sm text-muted-foreground">{movement.reason}</p> : null}
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{formatQuantity(movement.quantity)} {item.unit}</p>
                  <p>{formatDate(movement.created_at)}</p>
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Aun no hay movimientos registrados.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function OwnerInventoryPage() {
  const { canCreate, canEdit } = useOperatorPermission("inventario")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [isSavingMovement, setIsSavingMovement] = useState(false)
  const { restaurant, items, units, isLoading, isRefreshing, error, createItem, updateItem, registerMovement } = useOwnerInventory(debouncedSearchQuery)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchQuery])

  const criticalItems = items.filter((item) => item.status === "critical")
  const lowItems = items.filter((item) => item.status === "low")
  const itemInitialValues = selectedItem || {
    name: "",
    sku: "",
    unit_type: units[0]?.id || "",
    current_stock: "0",
    min_stock: "",
    max_stock: "",
  }

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventario</h2>
          <p className="text-muted-foreground">Gestiona el stock real de ingredientes de {restaurant?.name || "tu restaurante"}</p>
        </div>
        {canCreate ? (
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setSelectedItem(null)
              setItemDialogOpen(true)
            }}
            disabled={!restaurant}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar ingrediente
          </Button>
        ) : null}
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total ingredientes</p>
              <p className="text-3xl font-bold">{items.length}</p>
            </div>
            <Package className="h-10 w-10 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className={lowItems.length > 0 ? "border-yellow-500" : ""}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Stock bajo</p>
              <p className="text-3xl font-bold text-yellow-600">{lowItems.length}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-yellow-500" />
          </CardContent>
        </Card>
        <Card className={criticalItems.length > 0 ? "border-destructive" : ""}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Stock critico</p>
              <p className="text-3xl font-bold text-destructive">{criticalItems.length}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </CardContent>
        </Card>
      </div>

      {(criticalItems.length > 0 || lowItems.length > 0) ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertas de stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...criticalItems, ...lowItems.filter((item) => item.status !== "critical")].map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {getStatusBadge(item.status)}
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="text-sm">Quedan {formatQuantity(item.current_stock)} {item.unit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Lista de ingredientes</CardTitle>
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar ingrediente..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku || "Sin SKU"}</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{formatQuantity(item.current_stock)} / {item.max_stock ? formatQuantity(item.max_stock) : "-"} {item.unit}</span>
                      <span className="text-muted-foreground">Minimo {item.min_stock ? formatQuantity(item.min_stock) : "-"}</span>
                    </div>
                    <Progress value={getStockPercentage(item.current_stock, item.max_stock)} className="h-2" />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="text-sm text-muted-foreground">Actualizado: {formatDate(item.last_updated)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item)
                      setHistoryDialogOpen(true)
                    }}
                  >
                    Ver historial
                  </Button>
                  {canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item)
                        setItemDialogOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item)
                        setMovementDialogOpen(true)
                      }}
                    >
                      Actualizar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {items.length === 0 ? <p className="text-sm text-muted-foreground">No hay ingredientes registrados.</p> : null}
          </div>
        </CardContent>
      </Card>

      <InventoryItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        initialValues={itemInitialValues}
        units={units}
        restaurantId={restaurant?.id}
        isSaving={isSavingItem}
        onSubmit={async (payload) => {
          try {
            setIsSavingItem(true)
            if (selectedItem?.id) {
              await updateItem(selectedItem.id, payload)
              toast.success("Ingrediente actualizado")
            } else {
              await createItem(payload)
              toast.success("Ingrediente creado")
            }
            setItemDialogOpen(false)
            setSelectedItem(null)
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible guardar el ingrediente")
          } finally {
            setIsSavingItem(false)
          }
        }}
      />

      <MovementDialog
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
        item={selectedItem}
        isSaving={isSavingMovement}
        onSubmit={async (payload) => {
          if (!selectedItem) {
            return
          }

          try {
            setIsSavingMovement(true)
            await registerMovement(selectedItem.id, payload)
            toast.success("Stock actualizado")
            setMovementDialogOpen(false)
            setSelectedItem(null)
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible actualizar el stock")
          } finally {
            setIsSavingMovement(false)
          }
        }}
      />

      <MovementHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        item={selectedItem}
      />
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function normalizeDecimal(value) {
  return String(value || 0)
}

function normalizeNullableDecimal(value) {
  return value === "" ? null : String(value)
}
