import { Lock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Renders a disabled button with a lock icon and tooltip when the user lacks
 * the required plan permission. Renders children normally when allowed.
 *
 * @param {boolean} locked - Whether to show the locked state
 * @param {string} planName - Plan name to show in tooltip (e.g. "Pro")
 * @param {React.ReactNode} children - The actual button/trigger when unlocked
 */
export function LockedAction({ locked, planName, children }) {
  if (!locked) return children

  const label = planName ? `Mejora a ${planName} para desbloquear` : "Funcionalidad no disponible en tu plan"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled="true"
            tabIndex="-1"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground opacity-60 select-none"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            onKeyDown={(e) => e.preventDefault()}
          >
            <Lock className="h-3.5 w-3.5" />
            {typeof children === "string" ? children : null}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
