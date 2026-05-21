import { AlertTriangle } from "lucide-react"
import { useAuth } from "@/context/auth-context"

export function CancellationBanner() {
  const { user } = useAuth()
  const subscription = user?.subscription

  if (!subscription || !subscription.cancelled_at) return null

  const endDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 text-sm text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Tu suscripción está cancelada y vence{endDate ? ` el ${endDate}` : " al final del periodo"}.
        {" "}
        <a href="/dashboard/restaurante/suscripcion" className="font-medium underline underline-offset-2">
          Reactivar
        </a>
      </span>
    </div>
  )
}
