import { Clock } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

export function TrialBanner() {
  const { user } = useAuth()
  const subscription = user?.subscription

  if (!subscription || subscription.status !== "trial" || !subscription.trial_end) return null

  const trialEnd = new Date(subscription.trial_end)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)))

  if (daysLeft <= 0) return null

  const urgent = daysLeft <= 3

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        urgent
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
      )}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        Tu prueba gratuita vence en <strong>{daysLeft} día{daysLeft !== 1 ? "s" : ""}</strong>.
        {" "}
        <a href="/dashboard/restaurante/suscripcion" className="underline underline-offset-2">
          Ver planes
        </a>
      </span>
    </div>
  )
}
