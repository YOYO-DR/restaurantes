import { Navigate } from "react-router-dom"
import { AuthScreenSkeleton } from "@/components/ui/app-skeletons"
import { useAuth } from "@/context/auth-context"
import { dashboardPathByRole } from "@/lib/auth-routing"

export function ProtectedRoute({ allowedRoles, children }) {
  const { activeRole, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <AuthScreenSkeleton />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to={dashboardPathByRole(activeRole)} replace />
  }

  return children
}
