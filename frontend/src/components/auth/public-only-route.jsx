import { Navigate } from "react-router-dom"
import { AuthScreenSkeleton } from "@/components/ui/app-skeletons"
import { useAuth } from "@/context/auth-context"
import { dashboardPathByRole } from "@/lib/auth-routing"

export function PublicOnlyRoute({ children }) {
  const { user, activeRole, isLoading } = useAuth()

  if (isLoading) {
    return <AuthScreenSkeleton />
  }

  if (user) {
    return <Navigate to={dashboardPathByRole(activeRole)} replace />
  }

  return children
}
