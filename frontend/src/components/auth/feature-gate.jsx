import { usePlanFeature } from "@/hooks/use-plan-feature"

/**
 * Renders children only if the user has the required plan feature permission.
 * If not, renders `fallback` (null by default).
 *
 * @param {string} feature - Feature code (e.g. "lealtad")
 * @param {"view"|"create"|"edit"|"delete"} action - Required action (default "view")
 * @param {React.ReactNode} fallback - What to render when access is denied
 */
export function FeatureGate({ feature, action = "view", fallback = null, children }) {
  const perms = usePlanFeature(feature)

  const actionMap = {
    view: perms.canView,
    create: perms.canCreate,
    edit: perms.canEdit,
    delete: perms.canDelete,
  }

  const allowed = actionMap[action] ?? perms.canView

  if (!allowed) return fallback
  return children
}
