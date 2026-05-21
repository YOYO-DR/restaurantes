import { useState } from "react"
import { toast } from "sonner"
import { useBilling } from "@/hooks/use-billing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, Clock, CreditCard, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const STATUS_LABELS = {
  trial: "Período de prueba",
  active: "Activa",
  cancelled: "Cancelada",
  expired: "Expirada",
}

const STATUS_COLORS = {
  trial: "default",
  active: "outline",
  cancelled: "secondary",
  expired: "secondary",
}

export default function OwnerSuscripcionPage() {
  const { plans, subscription, changeRequests, loading, requestPlanChange, cancelSubscription } = useBilling()
  const [upgradeDialog, setUpgradeDialog] = useState(null)
  const [cancelDialog, setCancelDialog] = useState(false)
  const [notes, setNotes] = useState("")
  const [requesting, setRequesting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleRequestUpgrade = async () => {
    if (!upgradeDialog) return
    setRequesting(true)
    try {
      await requestPlanChange(upgradeDialog.id, notes)
      toast.success("Solicitud enviada. El equipo la revisará pronto.")
      setUpgradeDialog(null)
      setNotes("")
    } catch (err) {
      toast.error(err?.detail ?? "Error al enviar la solicitud")
    } finally {
      setRequesting(false)
    }
  }

  const doCancel = async () => {
    setCancelling(true)
    try {
      await cancelSubscription()
      toast.success("Suscripción cancelada. Seguirás activo hasta el fin del período.")
    } catch (err) {
      toast.error(err?.detail ?? "Error al cancelar")
    } finally {
      setCancelling(false)
    }
  }

  const hasPendingRequest = changeRequests.some((r) => r.status === "pending")

  if (loading) return <p className="text-muted-foreground">Cargando suscripción…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Suscripción</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu plan y funcionalidades</p>
      </div>

      {/* Estado actual */}
      {subscription ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Plan actual
              </CardTitle>
              <Badge variant={STATUS_COLORS[subscription.status]}>
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{subscription.plan_name}</p>
              {subscription.plan_price && Number(subscription.plan_price) > 0 && (
                <p className="text-muted-foreground">${Number(subscription.plan_price).toLocaleString()} / mes</p>
              )}
            </div>

            {subscription.status === "trial" && subscription.trial_end && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  Período de prueba: vence el{" "}
                  <strong>{new Date(subscription.trial_end).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</strong>
                </span>
              </div>
            )}

            {subscription.cancelled_at && subscription.current_period_end && (
              <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>
                  Cancelada — acceso hasta el{" "}
                  <strong>{new Date(subscription.current_period_end).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</strong>
                </span>
              </div>
            )}

            {!subscription.cancelled_at && subscription.status === "active" && (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelDialog(true)} disabled={cancelling}>
                Cancelar suscripción
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">Sin suscripción activa</CardContent>
        </Card>
      )}

      {/* Solicitudes pendientes */}
      {changeRequests.filter((r) => r.status === "pending").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Solicitudes pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {changeRequests.filter((r) => r.status === "pending").map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>Cambio a <strong>{r.requested_plan_name}</strong></span>
                <Badge variant="default"><Clock className="mr-1 h-3 w-3" />En revisión</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Planes disponibles */}
      {plans.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Planes disponibles</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan === plan.id || subscription?.plan_code === plan.code
              return (
                <Card key={plan.id} className={isCurrent ? "ring-2 ring-primary" : ""}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-lg font-bold">
                          {Number(plan.price_amount) === 0 ? "Gratis" : `$${Number(plan.price_amount).toLocaleString()} ${plan.currency_code}/mes`}
                        </p>
                      </div>
                      {isCurrent && <Badge variant="outline"><CheckCircle className="mr-1 h-3 w-3" />Actual</Badge>}
                    </div>
                    {!isCurrent && !hasPendingRequest && !subscription?.cancelled_at && (
                      <Button size="sm" className="w-full" onClick={() => { setUpgradeDialog(plan); setNotes("") }}>
                        Solicitar cambio
                      </Button>
                    )}
                    {hasPendingRequest && !isCurrent && (
                      <p className="text-xs text-muted-foreground">Ya tienes una solicitud pendiente</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial de solicitudes */}
      {changeRequests.filter((r) => r.status !== "pending").length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground">Historial</h2>
          {changeRequests.filter((r) => r.status !== "pending").map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("es-CO")} — {r.current_plan_name} → {r.requested_plan_name}
              </span>
              <Badge variant={r.status === "approved" ? "outline" : "secondary"}>
                {r.status === "approved" ? "Aprobada" : r.status === "rejected" ? "Rechazada" : "Supersedida"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cancelación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seguirás teniendo acceso a todas las funcionalidades hasta el final del período de facturación actual.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Volver</Button>
            <Button
              variant="destructive"
              disabled={cancelling}
              onClick={async () => { setCancelDialog(false); await doCancel() }}
            >
              {cancelling ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!upgradeDialog} onOpenChange={(open) => { if (!open) setUpgradeDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar cambio a {upgradeDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tu solicitud será revisada por el equipo de soporte. Recibirás una notificación cuando sea procesada.
            </p>
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="¿Por qué quieres cambiar de plan?" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialog(null)}>Cancelar</Button>
            <Button onClick={handleRequestUpgrade} disabled={requesting}>
              {requesting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
