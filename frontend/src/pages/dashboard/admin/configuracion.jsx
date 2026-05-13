import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, Database, Loader2, Lock, Save, Settings, Shield } from "lucide-react"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminSettings } from "@/hooks/use-admin"

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "security", label: "Seguridad", icon: Lock },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "compliance", label: "Cumplimiento", icon: Shield },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general")
  const [form, setForm] = useState(null)
  const { data, isLoading, isSaving, error, saveSettings } = useAdminSettings()

  useEffect(() => {
    if (!data) {
      return
    }

    setForm({
      general: {
        platform_name: data.general.platform_name || "",
        support_email: data.general.support_email || "",
        support_phone: data.general.support_phone || "",
        support_address: data.general.support_address || "",
        default_currency_code: data.general.default_currency_code || "COP",
        default_locale: data.general.default_locale || "es-CO",
        maintenance_mode: Boolean(data.general.maintenance_mode),
      },
      security: {
        require_2fa_admin: Boolean(data.security.require_2fa_admin),
        require_restaurant_verification: Boolean(data.security.require_restaurant_verification),
        encrypt_payment_data: Boolean(data.security.encrypt_payment_data),
        backup_frequency: data.security.backup_frequency || "daily",
        backup_retention_days: String(data.security.backup_retention_days || 30),
      },
    })
  }, [data])

  const handleSave = async () => {
    if (!form) {
      return
    }

    try {
      await saveSettings({
        general: form.general,
        security: {
          ...form.security,
          backup_retention_days: Number(form.security.backup_retention_days || 0),
        },
      })
      toast.success("Configuracion administrativa actualizada")
    } catch {
      toast.error("No fue posible guardar la configuracion")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configuracion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Panel real para parametros globales de plataforma y seguridad operacional.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border">
        {/* eslint-disable-next-line no-unused-vars */}
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {!isLoading && form ? (
        <>
          {activeTab === "general" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Informacion de plataforma</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Nombre de la plataforma">
                    <Input value={form.general.platform_name} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, platform_name: event.target.value } }))} />
                  </Field>
                  <Field label="Email de soporte">
                    <Input type="email" value={form.general.support_email} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, support_email: event.target.value } }))} />
                  </Field>
                  <Field label="Telefono de soporte">
                    <Input value={form.general.support_phone} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, support_phone: event.target.value } }))} />
                  </Field>
                  <Field label="Direccion de soporte">
                    <Input value={form.general.support_address} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, support_address: event.target.value } }))} />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preferencias globales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Moneda por defecto">
                    <Input value={form.general.default_currency_code} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, default_currency_code: event.target.value.toUpperCase() } }))} />
                  </Field>
                  <Field label="Locale por defecto">
                    <Input value={form.general.default_locale} onChange={(event) => setForm((current) => ({ ...current, general: { ...current.general, default_locale: event.target.value } }))} />
                  </Field>
                  <ToggleRow
                    title="Modo mantenimiento"
                    description="Permite activar una bandera global de mantenimiento para la plataforma."
                    checked={form.general.maintenance_mode}
                    onChange={(checked) => setForm((current) => ({ ...current, general: { ...current.general, maintenance_mode: checked } }))}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Seguridad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ToggleRow
                    title="Requerir 2FA para admins"
                    description="Bandera operativa para reforzar acceso privilegiado."
                    checked={form.security.require_2fa_admin}
                    onChange={(checked) => setForm((current) => ({ ...current, security: { ...current.security, require_2fa_admin: checked } }))}
                  />
                  <ToggleRow
                    title="Verificacion de restaurantes"
                    description="Controla si el onboarding requiere revision administrativa."
                    checked={form.security.require_restaurant_verification}
                    onChange={(checked) => setForm((current) => ({ ...current, security: { ...current.security, require_restaurant_verification: checked } }))}
                  />
                  <ToggleRow
                    title="Encriptar datos de pago"
                    description="Bandera documental para la politica de manejo de pagos."
                    checked={form.security.encrypt_payment_data}
                    onChange={(checked) => setForm((current) => ({ ...current, security: { ...current.security, encrypt_payment_data: checked } }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backups y retencion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Frecuencia de backup">
                    <Select value={form.security.backup_frequency} onValueChange={(value) => setForm((current) => ({ ...current, security: { ...current.security, backup_frequency: value } }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Frecuencia de backup" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.catalogs.backup_frequencies.map((option) => (
                          <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Dias de retencion">
                    <Input
                      type="number"
                      min="1"
                      value={form.security.backup_retention_days}
                      onChange={(event) => setForm((current) => ({ ...current, security: { ...current.security, backup_retention_days: event.target.value } }))}
                    />
                  </Field>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <Card>
              <CardHeader>
                <CardTitle>Indicadores operativos actuales</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Email de soporte activo" value={data.general.support_email || "Sin definir"} />
                <InfoBlock title="Telefono de soporte" value={data.general.support_phone || "Sin definir"} />
                <InfoBlock title="Modo mantenimiento" value={data.general.maintenance_mode ? "Activo" : "Inactivo"} />
                <InfoBlock title="2FA administradores" value={data.security.require_2fa_admin ? "Requerido" : "No requerido"} />
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "compliance" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Planes disponibles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.catalogs.subscription_plans.map((plan) => (
                    <div key={plan.code} className="rounded-xl border border-border/70 p-4">
                      <p className="font-medium text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {plan.billing_period} · {plan.currency_code} {plan.price_amount}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Capacidad de cumplimiento actual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoBlock title="Frecuencia de backup" value={data.security.backup_frequency_label} />
                  <InfoBlock title="Retencion" value={`${data.security.backup_retention_days} dias`} />
                  <InfoBlock title="Verificacion de restaurantes" value={data.security.require_restaurant_verification ? "Habilitada" : "Deshabilitada"} />
                  <Button variant="outline" className="w-full justify-start gap-2" disabled>
                    <Database className="h-4 w-4" />
                    Accion manual de backup aun no implementada
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded" />
    </div>
  )
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  )
}
