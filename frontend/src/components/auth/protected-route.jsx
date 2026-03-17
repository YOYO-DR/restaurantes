import { Navigate } from "react-router-dom"
import { AuthScreenSkeleton } from "@/components/ui/app-skeletons"
import { useAuth } from "@/context/auth-context"
import { dashboardPathByRole } from "@/lib/auth-routing"

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <AuthScreenSkeleton />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardPathByRole(user.role)} replace />
  }

  return children
}
