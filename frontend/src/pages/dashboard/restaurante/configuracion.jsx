import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useOwnerRestaurantSettings } from "@/hooks/use-restaurants"
import { Clock, Info, Loader2, Store, Truck } from "lucide-react"

const ORDER_TYPE_INFO = {
  delivery: {
    label: "Habilitar delivery",
    description: "Los clientes pueden solicitar domicilios. El pedido se entrega en la direccion que indiquen. Aplica costo de envio configurado.",
  },
  pickup: {
    label: "Habilitar pickup",
    description: "Los clientes pueden hacer pedidos para recoger en el restaurante. Realizan el pago en linea y pasan a retirar cuando este listo.",
  },
  table: {
    label: "Habilitar pedidos en mesa",
    description: "Los clientes que estan fisicamente en el restaurante pueden ordenar desde su mesa escaneando un codigo o seleccionando su mesa. Ideal para servicio sin mesero.",
  },
}

export default function ConfiguracionRestaurantePage() {
  const { data, isLoading, isSaving, error, reload, saveSettings } = useOwnerRestaurantSettings()
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  if (!form) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
          <p className="text-muted-foreground">Administra la configuracion de tu restaurante</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No se pudo cargar la configuracion</CardTitle>
            <CardDescription>{error || "No hay datos del restaurante disponibles para esta cuenta"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={reload}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">Administra la configuracion de tu restaurante</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general" className="gap-2"><Store className="h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2"><Clock className="h-4 w-4" />Horarios</TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2"><Truck className="h-4 w-4" />Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacion del Negocio</CardTitle>
              <CardDescription>Datos basicos de tu restaurante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del negocio" value={form.business_name} onChange={(value) => setForm((current) => ({ ...current, business_name: value }))} />
                <Field label="Telefono" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Correo" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                <Field label="Ciudad" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Moneda del restaurante" value={form.currency_code || "COP"} onChange={(value) => setForm((current) => ({ ...current, currency_code: value.toUpperCase().slice(0, 3) }))} />
              </div>
              <Field label="Direccion" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Horario de Atencion</CardTitle>
              <CardDescription>Define cuando tu restaurante esta abierto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.schedule.map((item, index) => (
                <div key={item.weekday} className="flex items-center gap-4">
                  <div className="w-24">
                    <p className="font-medium">{item.label.split(":")[0]}</p>
                  </div>
                  <Switch
                    checked={!item.is_closed}
                    onCheckedChange={(checked) => {
                      setForm((current) => {
                        const schedule = [...current.schedule]
                        schedule[index] = {
                          ...schedule[index],
                          is_closed: !checked,
                          open_time: checked ? item.open_time || "09:00" : null,
                          close_time: checked ? item.close_time || "18:00" : null,
                        }
                        return { ...current, schedule }
                      })
                    }}
                  />
                  {!item.is_closed ? (
                    <>
                      <Input
                        type="time"
                        className="w-32"
                        value={item.open_time || ""}
                        onChange={(event) => {
                          setForm((current) => {
                            const schedule = [...current.schedule]
                            schedule[index] = { ...schedule[index], open_time: event.target.value }
                            return { ...current, schedule }
                          })
                        }}
                      />
                      <span className="text-muted-foreground">a</span>
                      <Input
                        type="time"
                        className="w-32"
                        value={item.close_time || ""}
                        onChange={(event) => {
                          setForm((current) => {
                            const schedule = [...current.schedule]
                            schedule[index] = { ...schedule[index], close_time: event.target.value }
                            return { ...current, schedule }
                          })
                        }}
                      />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Cerrado</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuracion de Delivery</CardTitle>
              <CardDescription>Opciones de entrega y pedido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRowWithInfo
                label={ORDER_TYPE_INFO.delivery.label}
                description={ORDER_TYPE_INFO.delivery.description}
                checked={form.delivery_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, delivery_enabled: checked }))}
              />
              <ToggleRowWithInfo
                label={ORDER_TYPE_INFO.pickup.label}
                description={ORDER_TYPE_INFO.pickup.description}
                checked={form.pickup_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, pickup_enabled: checked }))}
              />
              <ToggleRowWithInfo
                label={ORDER_TYPE_INFO.table.label}
                description={ORDER_TYPE_INFO.table.description}
                checked={form.table_order_enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, table_order_enabled: checked }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Costo de envio" type="number" value={String(form.delivery_fee_amount ?? "")} onChange={(value) => setForm((current) => ({ ...current, delivery_fee_amount: value }))} />
                <Field label="Pedido minimo" type="number" value={String(form.min_order_amount ?? "")} onChange={(value) => setForm((current) => ({ ...current, min_order_amount: value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tiempo minimo (min)" type="number" value={String(form.estimated_min_minutes ?? "")} onChange={(value) => setForm((current) => ({ ...current, estimated_min_minutes: value }))} />
                <Field label="Tiempo maximo (min)" type="number" value={String(form.estimated_max_minutes ?? "")} onChange={(value) => setForm((current) => ({ ...current, estimated_max_minutes: value }))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button
        onClick={async () => {
          try {
            await saveSettings({
              ...form,
              currency_code: (form.currency_code || "COP").toUpperCase(),
              delivery_fee_amount: normalizeRequiredDecimal(form.delivery_fee_amount),
              min_order_amount: normalizeOptionalDecimal(form.min_order_amount),
              estimated_min_minutes: normalizeOptionalInteger(form.estimated_min_minutes),
              estimated_max_minutes: normalizeOptionalInteger(form.estimated_max_minutes),
              schedule: form.schedule.map((item) => ({
                weekday: item.weekday,
                open_time: item.is_closed ? null : item.open_time || null,
                close_time: item.is_closed ? null : item.close_time || null,
                is_closed: item.is_closed,
              })),
            })
            toast.success("Configuracion actualizada")
          } catch (saveError) {
            toast.error(saveError.message || "No fue posible guardar la configuracion")
          }
        }}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar configuracion"
        )}
      </Button>
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

function ToggleRow({ label, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">{label}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ToggleRowWithInfo({ label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <p className="font-medium">{label}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-w-xs text-sm">{description}</PopoverContent>
        </Popover>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function normalizeRequiredDecimal(value) {
  if (value === null || value === undefined || value === "") {
    return "0"
  }

  return String(value)
}

function normalizeOptionalDecimal(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  return String(value)
}

function normalizeOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  return Number(value)
}
