import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { useCustomerSettings } from "@/hooks/use-orders"
import { Bell, CreditCard, LogOut, Mail, Plus, Shield, Smartphone, Trash2 } from "lucide-react"

const PREFERENCE_MAP = {
  "email:order_updates": {
    key: "email_order_updates",
    title: "Correo electronico",
    description: "Recibe notificaciones por email sobre pedidos",
    icon: Mail,
  },
  "push:order_updates": {
    key: "push_order_updates",
    title: "Notificaciones push",
    description: "Notificaciones del estado de tus pedidos",
    icon: Smartphone,
  },
  "sms:order_updates": {
    key: "sms_order_updates",
    title: "SMS",
    description: "Mensajes de texto para cambios importantes",
    icon: Smartphone,
  },
  "email:promotions": {
    key: "email_promotions",
    title: "Promociones y ofertas",
    description: "Descuentos exclusivos y cupones",
    icon: Bell,
  },
  "push:promotions": {
    key: "push_promotions",
    title: "Push de promociones",
    description: "Alertas de promociones en tiempo real",
    icon: Bell,
  },
  "email:newsletter": {
    key: "email_newsletter",
    title: "Newsletter",
    description: "Novedades y restaurantes nuevos",
    icon: Mail,
  },
}

export default function ClienteConfiguracionPage() {
  const { preferences, paymentMethods, isLoading, isSaving, error, updatePreference, addPaymentMethod, removePaymentMethod } = useCustomerSettings()
  const [newPayment, setNewPayment] = useState({
    brand: "VISA",
    masked_number: "",
    expires_month: "",
    expires_year: "",
  })

  const groupedPreferences = useMemo(() => {
    return preferences
      .map((preference) => {
        const meta = PREFERENCE_MAP[`${preference.channel_code}:${preference.type_code}`]
        return { ...preference, meta }
      })
      .filter((preference) => Boolean(preference.meta))
  }, [preferences])

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">Administra las preferencias reales de tu cuenta</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>Estas opciones se guardan en backend y se aplican en la cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedPreferences.map((preference) => (
              <div key={preference.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <preference.meta.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{preference.meta.title}</p>
                    <p className="text-xs text-muted-foreground">{preference.meta.description}</p>
                  </div>
                </div>
                <Switch
                  checked={preference.is_enabled}
                  disabled={isSaving}
                  onCheckedChange={async (checked) => {
                    try {
                      await updatePreference(preference.id, Boolean(checked))
                      toast.success("Preferencia actualizada")
                    } catch (saveError) {
                      toast.error(saveError.message || "No fue posible actualizar la preferencia")
                    }
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Metodos de pago
            </CardTitle>
            <CardDescription>Datos gestionados por API interna mientras se integra pasarela externa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-xs font-bold">
                      {method.brand || "CARD"}
                    </div>
                    <div>
                      <p className="font-medium">{method.masked_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {method.expires_at ? `Vence ${new Date(method.expires_at).toLocaleDateString("es-CO", { month: "2-digit", year: "2-digit" })}` : "Sin fecha de expiracion"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={isSaving}
                    onClick={async () => {
                      try {
                        await removePaymentMethod(method.id)
                        toast.success("Metodo eliminado")
                      } catch (deleteError) {
                        toast.error(deleteError.message || "No fue posible eliminar el metodo")
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={newPayment.brand} onChange={(event) => setNewPayment((current) => ({ ...current, brand: event.target.value.toUpperCase() }))} placeholder="VISA" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Numero enmascarado</Label>
                <Input value={newPayment.masked_number} onChange={(event) => setNewPayment((current) => ({ ...current, masked_number: event.target.value }))} placeholder="**** **** **** 4242" />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <div className="flex gap-2">
                  <Input value={newPayment.expires_month} onChange={(event) => setNewPayment((current) => ({ ...current, expires_month: event.target.value }))} placeholder="MM" />
                  <Input value={newPayment.expires_year} onChange={(event) => setNewPayment((current) => ({ ...current, expires_year: event.target.value }))} placeholder="YY" />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="gap-2"
              disabled={isSaving || !newPayment.masked_number}
              onClick={async () => {
                try {
                  const month = (newPayment.expires_month || "").padStart(2, "0")
                  const year = (newPayment.expires_year || "").padStart(2, "0")
                  const expiresAt = month && year ? `20${year}-${month}-01T00:00:00Z` : null
                  await addPaymentMethod({
                    brand: newPayment.brand,
                    masked_number: newPayment.masked_number,
                    expires_at: expiresAt,
                  })
                  setNewPayment({ brand: "VISA", masked_number: "", expires_month: "", expires_year: "" })
                  toast.success("Metodo agregado")
                } catch (saveError) {
                  toast.error(saveError.message || "No fue posible agregar el metodo")
                }
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar metodo de pago
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>La actualizacion de contrasena se mantiene por flujo de autenticacion.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Actualizar contrasena (proximamente)</Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de peligro</CardTitle>
            <CardDescription>Acciones sensibles de la cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Cerrar sesion en todos los dispositivos</p>
                <p className="text-sm text-muted-foreground">Funcion pendiente de implementacion.</p>
              </div>
              <Button variant="outline" className="shrink-0" disabled>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesiones
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-destructive">Eliminar cuenta</p>
                <p className="text-sm text-muted-foreground">Esta accion es permanente y no se puede deshacer.</p>
              </div>
              <Button variant="destructive" className="shrink-0" disabled>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar cuenta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
