import { Navigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { usePlanFeature } from "@/hooks/use-plan-feature"

/**
 * Wraps a route and redirects to /dashboard/restaurante/suscripcion
 * if the active plan doesn't grant the required feature action.
 *
 * @param {string} feature - Feature code
 * @param {"view"|"create"|"edit"|"delete"} action - Required action (default "view")
 */
export function PlanProtectedRoute({ feature, action = "view", children }) {
  const { activeRole } = useAuth()
  const perms = usePlanFeature(feature)

  // Admins bypass plan checks
  if (activeRole === "admin") return children

  const actionMap = {
    view: perms.canView,
    create: perms.canCreate,
    edit: perms.canEdit,
    delete: perms.canDelete,
  }
  const allowed = actionMap[action] ?? perms.canView

  if (!allowed) {
    return <Navigate to="/dashboard/restaurante/suscripcion" replace />
  }
  return children
}
