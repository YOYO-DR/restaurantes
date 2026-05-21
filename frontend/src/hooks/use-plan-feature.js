import { useAuth } from "@/context/auth-context"

const FULL_ACCESS = { canView: true, canCreate: true, canEdit: true, canDelete: true, isLocked: false }
const NO_ACCESS = { canView: false, canCreate: false, canEdit: false, canDelete: false, isLocked: true }

export function usePlanFeature(module) {
  const { user } = useAuth()

  // Admins bypass all plan checks — validated against server-side roles, not localStorage
  if (user?.roles?.includes("admin") || user?.role === "admin") return { ...FULL_ACCESS, planCode: null }

  const subscription = user?.subscription
  if (!subscription) return { ...NO_ACCESS, planCode: null }

  const feature = subscription.features?.[module]
  if (!feature) return { ...NO_ACCESS, planCode: subscription.plan }

  return {
    canView: feature.can_view ?? false,
    canCreate: feature.can_create ?? false,
    canEdit: feature.can_edit ?? false,
    canDelete: feature.can_delete ?? false,
    isLocked: !(feature.can_view ?? false),
    planCode: subscription.plan,
    planName: subscription.plan_name,
    status: subscription.status,
    trialEnd: subscription.trial_end,
  }
}
