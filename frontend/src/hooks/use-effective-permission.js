import { useOperatorPermission } from "@/hooks/use-operator-permission"
import { usePlanFeature } from "@/hooks/use-plan-feature"

/**
 * AND of operator permission + plan feature permission.
 * A user needs both to access a module action.
 */
export function useEffectivePermission(module) {
  const op = useOperatorPermission(module)
  const plan = usePlanFeature(module)

  return {
    canView: op.canView && plan.canView,
    canCreate: op.canCreate && plan.canCreate,
    canEdit: op.canEdit && plan.canEdit,
    canDelete: op.canDelete && plan.canDelete,
    isLocked: plan.isLocked,
    planCode: plan.planCode,
    planName: plan.planName,
  }
}
