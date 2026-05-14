import { useAuth } from "@/context/auth-context"

const FULL_ACCESS = { canView: true, canCreate: true, canEdit: true, canDelete: true }

export function useOperatorPermission(module) {
  const { user } = useAuth()
  const perms = user?.operator_permissions?.[module]
  if (!perms) return FULL_ACCESS
  return {
    canView: perms.can_view,
    canCreate: perms.can_create,
    canEdit: perms.can_edit,
    canDelete: perms.can_delete,
  }
}
